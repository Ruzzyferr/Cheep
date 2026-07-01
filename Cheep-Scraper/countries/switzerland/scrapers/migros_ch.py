"""Migros CH scraper — anchor.

Recon (2026-07-02): a plain `requests` GET of https://www.migros.ch/ returns
200 but is just the Angular SPA shell (no product data server-side). Driving a
real (headless) Chromium session via Playwright and navigating a search page
(https://www.migros.ch/en/search?query=...) triggers an XHR to

    GET https://www.migros.ch/product-display/public/v4/product-cards

which returns a JSON array of product cards — this is the real field shape
`parse()` below is built against (see countries/switzerland/fixtures/migros_ch_sample.json,
captured live from that endpoint).

Pure parse() is fixture-testable (no network); fetch_products() is live and
drives Playwright to reach the same endpoint for arbitrary search terms.
"""
import importlib.util
import json
import sys
from decimal import Decimal
from pathlib import Path
from typing import List, Optional

_REPO_ROOT = Path(__file__).resolve().parents[3]  # .../Cheep-Scraper
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _load_repo_root_module(name: str, relpath: str):
    """Load a repo-root module by absolute file path under a private key.

    This file lives at countries/switzerland/scrapers/migros_ch.py — a
    directory ALSO named `scrapers`. Test harnesses that put this country's
    directory ahead of the repo root on sys.path (see tests/test_ch_scrapers.py)
    cause a plain `from scrapers.base_scraper import ...` to resolve `scrapers`
    to *this* local package instead of the repo-root one, raising
    ModuleNotFoundError. Loading by explicit file path sidesteps the name
    collision entirely; base_scraper.py/units.py have no further `scrapers.*`
    imports at module scope, so this is safe.
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

BASE = "https://www.migros.ch"
CARDS_URL = f"{BASE}/product-display/public/v4/product-cards"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# Curated search terms — broad coverage across canonical categories (mirrors
# the TR Migros scraper's approach of harvesting via search rather than
# category pages, since the CH catalog is also search/API driven).
SEARCH_TERMS = [
    "milch", "kaese", "joghurt", "eier", "butter", "rahm",
    "poulet", "rindfleisch", "fisch", "wurst", "schinken",
    "tomaten", "gurken", "kartoffeln", "zwiebeln", "aepfel", "bananen",
    "reis", "pasta", "mehl", "zucker", "salz", "oel", "essig",
    "wasser", "cola", "saft", "kaffee", "tee",
    "schokolade", "guetzli", "chips",
    "brot", "gebaeck",
    "waschmittel", "putzmittel", "toilettenpapier",
    "shampoo", "duschgel", "zahnpasta",
]


class MigrosCHScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Migros")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Parse a saved `product-cards` payload (JSON array) into Products.

        Real field paths observed in the fixture:
        - name/title/description: `title` (fullest display string) with
          `name`/`description` as fallbacks.
        - brand: `brand` (often null for house-brand/no-name items).
        - price: `offer.price.effectiveValue` (current price the shopper
          pays); `offer.price.advertisedValue` is the pre-promo price when it
          differs.
        - quantity/unit: `offer.quantity` (e.g. "1l", "500ml", "6 x 1l").
        - barcode: `gtins[0]` (list of EAN/GTIN codes; may repeat historical
          barcodes for the same SKU — first is current).
        - sku: `migrosId` (falls back to `migrosOnlineId`/`uid`).
        - category: last entry of `breadcrumb` (deepest category name).
        - image: `imageTransparent.url` (falls back to `images[0].url`); URL
          contains a literal `{stack}` placeholder Migros' CDN expects a size
          token for — left as-is (informational only).
        - product_url: top-level `productUrls` (not nested under `offer`).

        Items with no `offer.price` (not currently orderable) are skipped.
        """
        data = json.loads(raw_text)
        items = data if isinstance(data, list) else data.get("products", [])
        products: List[Product] = []
        for item in items:
            offer = item.get("offer") or {}
            price_obj = offer.get("price") or {}
            effective = price_obj.get("effectiveValue")
            if effective in (None, ""):
                continue  # not currently orderable

            name = item.get("title") or item.get("description") or item.get("name")
            if not name or not str(name).strip():
                continue

            price = Decimal(str(effective))
            advertised = price_obj.get("advertisedValue")
            original = (Decimal(str(advertised))
                        if advertised not in (None, "") and Decimal(str(advertised)) != price
                        else None)

            gtins = item.get("gtins") or []
            barcode = str(gtins[0]) if gtins else None

            sku = str(item.get("migrosId") or item.get("migrosOnlineId") or item.get("uid") or name)[:64]

            breadcrumb = item.get("breadcrumb") or []
            raw_category = breadcrumb[-1].get("name") if breadcrumb else None

            image_url = None
            img_t = item.get("imageTransparent") or {}
            if img_t.get("url"):
                image_url = img_t["url"]
            else:
                images = item.get("images") or []
                if images and isinstance(images[0], dict):
                    image_url = images[0].get("url")

            qty, unit = parse_quantity_and_unit(offer.get("quantity"))
            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

            products.append(Product(
                name=str(name).strip(),
                price=price,
                store="Migros",
                brand=item.get("brand"),
                barcode=barcode,
                sku=sku,
                raw_category=raw_category,
                unit=unit,
                quantity=qty,
                unit_price=unit_price,
                unit_price_unit=unit_price_unit,
                original_price=original,
                image_url=image_url,
                product_url=item.get("productUrls"),
                country_code="CH",
            ))
        return products

    def fetch_products(self, terms: Optional[List[str]] = None) -> List[Product]:
        """Live path: drive a headless browser through a search so the SPA's
        own XHR calls populate `product-display/public/v4/product-cards`,
        then parse the captured response bodies. Requires Playwright/Chromium.
        """
        from playwright.sync_api import sync_playwright

        terms = terms or SEARCH_TERMS
        seen_sku = set()
        products: List[Product] = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=UA, locale="en-CH")
            page = ctx.new_page()
            for term in terms:
                bodies = []

                def on_resp(r, _bodies=bodies):
                    if CARDS_URL in r.url:
                        try:
                            _bodies.append(r.text())
                        except Exception as e:
                            self.logger.debug(f"product-cards body unavailable: {e}")

                page.on("response", on_resp)
                try:
                    page.goto(f"{BASE}/en/search?query={term}",
                               wait_until="networkidle", timeout=30000)
                    page.wait_for_timeout(1500)
                except Exception as e:
                    self.logger.warning(f"'{term}' navigation failed: {e}")
                page.remove_listener("response", on_resp)

                for body in bodies:
                    for prod in self.parse(body):
                        if prod.sku in seen_sku:
                            continue
                        seen_sku.add(prod.sku)
                        products.append(prod)
                self.logger.info(f"'{term}': total {len(products)}")
            browser.close()
        return products

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        return Decimal(
            str(price_str).replace("CHF", "").replace("Fr.", "").replace(",", ".").strip()
        )
