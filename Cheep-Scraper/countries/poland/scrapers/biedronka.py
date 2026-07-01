"""Biedronka (Poland) scraper.

Recon (2026-07-02): the corporate/leaflet site `https://www.biedronka.pl/pl`
is reachable (200) but is a gazetka/leaflet-only marketing site with no
product+price catalog. However, Biedronka also runs a genuine e-commerce
storefront at `https://zakupy.biedronka.pl/` ("zakupy" = "shopping") — a
Salesforce Commerce Cloud (Demandware) site (`Sites-PL_Catalog` /
`Sites-Grocery-Biedronka-PL-Site`, `/on/demandware.static/...` asset paths).
A plain `requests` GET of both the homepage and category listing pages (e.g.
`https://zakupy.biedronka.pl/nabial/mleko/`) returns 200 with real,
server-rendered product tiles — no Cloudflare/WAF block, no Playwright
needed.

Each product tile embeds a `data-product-gtm="{...}"` JSON attribute (HTML-
entity-encoded, meant for Google Analytics 4 ecommerce tracking) with clean
`item_name`/`item_id`/`price`/`item_brand`/`item_category`..`item_category3`
fields — a far cleaner source than parsing the visual `price-tile__decimal`
markup. This is the real field shape `parse()` below is built against (see
countries/poland/fixtures/biedronka_sample.html, a live capture of
https://zakupy.biedronka.pl/nabial/mleko/, 10 real dairy products with
prices).

No EAN/GTIN field is present anywhere in the tile markup or the product
detail page (checked a live PDP fetch during recon) — barcode is left None,
honestly, same as Auchan PL.

Pure parse() is fixture-testable (no network); fetch_products() is live and
walks a curated list of real category URLs via plain `requests` (this is a
category-listing crawl, not a full-catalog crawl — Biedronka's storefront
has hundreds of leaf categories; the curated list below spans the canonical
grocery categories a price-comparison tool cares about).
"""
import html
import importlib.util
import json
import re
import sys
from decimal import Decimal
from pathlib import Path
from typing import List, Optional

_REPO_ROOT = Path(__file__).resolve().parents[3]  # .../Cheep-Scraper
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _load_repo_root_module(name: str, relpath: str):
    """Load a repo-root module by absolute file path under a private key.

    This file lives at countries/poland/scrapers/biedronka.py — a directory
    ALSO named `scrapers`. Test harnesses that put this country's directory
    ahead of the repo root on sys.path (see tests/test_pl_discounters.py)
    cause a plain `from scrapers.base_scraper import ...` to resolve
    `scrapers` to *this* local package instead of the repo-root one, raising
    ModuleNotFoundError. Loading by explicit file path sidesteps the name
    collision entirely; base_scraper.py/units.py have no further
    `scrapers.*` imports at module scope, so this is safe.
    """
    key = f"_cheep_root_{name}"
    if key in sys.modules:
        return sys.modules[key]
    spec = importlib.util.spec_from_file_location(key, _REPO_ROOT / relpath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[key] = mod
    spec.loader.exec_module(mod)
    return mod


_base_scraper = _load_repo_root_module("base_scraper", "scrapers/base_scraper.py")
_units = _load_repo_root_module("units", "scrapers/units.py")
BaseScraper = _base_scraper.BaseScraper
Product = _base_scraper.Product
parse_quantity_and_unit = _units.parse_quantity_and_unit
compute_unit_price = _units.compute_unit_price

BASE = "https://zakupy.biedronka.pl"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# Curated category listing pages spanning canonical grocery departments
# (recon-verified live during 2026-07-02 session; the storefront's own menu
# lists many more leaf categories than this — this is a representative
# crawl, not an exhaustive one).
CATEGORY_URLS = [
    f"{BASE}/nabial/mleko/",
    f"{BASE}/nabial/jogurty-naturalne/",
    f"{BASE}/nabial/sery/sery-zolte/",
    f"{BASE}/nabial/maslo/",
    f"{BASE}/pieczywo/",
    f"{BASE}/napoje/wody/",
    f"{BASE}/drogeria/papier-toaletowy-i-chusteczki/papier-toaletowy/",
]

_TILE_SPLIT_RE = re.compile(r'<div class="product-tile js-product-tile')
_GTM_RE = re.compile(r'data-product-gtm="([^"]+)"')
_IMAGE_RE = re.compile(r'<meta itemprop="image" content="([^"]+)"')
_ITEMID_RE = re.compile(r'data-itemid="([^"]+)"')


class BiedronkaScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Biedronka")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Parse a saved zakupy.biedronka.pl category page (HTML) into
        Products.

        Splits the page into per-tile chunks on the `product-tile
        js-product-tile` marker, then within each chunk extracts:
        - the `data-product-gtm="{...}"` JSON blob (HTML-entity-encoded) —
          `item_name` (name), `item_id` (sku, falls back to the tile's own
          `data-itemid`), `price` (decimal string, the price the shopper
          currently pays — this storefront does not expose a separate
          pre-promo/original price in the GTM payload), `item_brand`
          (brand), `item_category3`/`item_category2`/`item_category` (in
          that preference order — deepest first) for raw_category.
        - quantity/unit: parsed from `item_name` itself via the shared
          quantity/unit parser (e.g. "Mleko UHT 3,2% 1L" -> (1.0, "l")); the
          storefront doesn't expose gramaj as a separate structured field on
          the tile.
        - image: the tile's own `<meta itemprop="image" content="...">`
          (a concrete, absolute-relative CDN path — resolved to an absolute
          URL below).
        - barcode: not present anywhere in this markup -> left None,
          honestly (matches Auchan PL's finding for its own listing feed).

        Tiles with no parseable price, or an empty/whitespace name, are
        skipped.
        """
        products: List[Product] = []
        seen_ids = set()
        chunks = _TILE_SPLIT_RE.split(raw_text)[1:]  # drop preamble before first tile
        for chunk in chunks:
            gtm_match = _GTM_RE.search(chunk)
            if not gtm_match:
                continue
            try:
                gtm = json.loads(html.unescape(gtm_match.group(1)))
            except (ValueError, TypeError):
                continue

            name = gtm.get("item_name")
            if not name or not str(name).strip():
                continue

            price_raw = gtm.get("price")
            if price_raw in (None, ""):
                continue
            try:
                price = Decimal(str(price_raw))
            except Exception:
                continue
            if price <= 0:
                continue

            itemid_match = _ITEMID_RE.search(chunk)
            item_id = gtm.get("item_id") or (itemid_match.group(1) if itemid_match else None)
            if item_id and item_id in seen_ids:
                continue
            if item_id:
                seen_ids.add(item_id)

            raw_category = (gtm.get("item_category3") or gtm.get("item_category2")
                             or gtm.get("item_category"))

            image_match = _IMAGE_RE.search(chunk)
            image_url = None
            if image_match:
                src = image_match.group(1)
                if src.startswith("http"):
                    image_url = src
                elif src.startswith("/"):
                    image_url = BASE + src

            qty, unit = parse_quantity_and_unit(str(name))
            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

            sku = str(item_id or name)[:64]

            products.append(Product(
                name=str(name).strip(),
                price=price,
                store="Biedronka",
                brand=gtm.get("item_brand"),
                barcode=None,
                sku=sku,
                raw_category=raw_category,
                unit=unit,
                quantity=qty,
                unit_price=unit_price,
                unit_price_unit=unit_price_unit,
                original_price=None,
                image_url=image_url,
                product_url=None,
                country_code="PL",
            ))
        return products

    def fetch_products(self, category_urls: Optional[List[str]] = None) -> List[Product]:
        """Live path: plain `requests` GET of each curated category listing
        page (no Playwright/session needed — these pages are server-rendered
        and reachable directly, same as Auchan PL)."""
        import requests

        headers = {
            "User-Agent": UA,
            "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        }
        urls = category_urls or CATEGORY_URLS
        seen_sku = set()
        products: List[Product] = []
        for url in urls:
            try:
                resp = requests.get(url, headers=headers, timeout=20)
                resp.raise_for_status()
            except Exception as e:
                self.logger.warning(f"'{url}' fetch failed: {e}")
                continue
            for prod in self.parse(resp.text):
                if prod.sku in seen_sku:
                    continue
                seen_sku.add(prod.sku)
                products.append(prod)
        return products

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        # Polish prices use a comma decimal and often a trailing "zł"
        # (e.g. "3,49 zł").
        return Decimal(
            str(price_str).replace("zł", "").replace(",", ".").strip()
        )
