"""Żabka (Poland) scraper.

Recon (2026-07-02): Żabka's quick-commerce delivery app "Jush" is reachable
at `https://jush.pl/` (200) but that site is a plain WordPress marketing/
landing page for the mobile app (no `__NEXT_DATA__`/`__NUXT__`/inline JS
bundle at all — just Google-Analytics boilerplate + a WordPress cookie-
consent plugin) with links to the App Store/Google Play; no product catalog
is reachable through it from this egress (`jush.pl/sklep`, `/zamow`,
`app.jush.pl`, `sklep.jush.pl`, `api.jush.pl` all 404/unreachable) — the
actual delivery catalog lives inside the native app only.

However: Żabka's own corporate site `https://www.zabka.pl/` (also 200, also
plain `requests`, no Cloudflare/WAF, no Playwright needed) embeds a real
"this week's offers" WordPress/Gutenberg product carousel directly on the
homepage — genuine current names, brands-in-title, package sizes, and (for
roughly half the tiles) an explicit current zł price via a
`product-info__bottom-label` ("Najniższa cena w ciągu 30 dni: X zł" — the
EU Omnibus-Directive "lowest price in the last 30 days" disclosure, which
doubles as this week's real shelf/promo price on this carousel). This is the
real field shape `parse()` below is built against (see
countries/poland/fixtures/zabka_sample.html, a live capture of
https://www.zabka.pl/).

This is a curated homepage promo carousel (~16 tiles total observed, of
which ~9 carry an unambiguous single-value price — tiles with no price
label, or whose package size is only expressed as a multi-variant range
with no matching single price, are skipped rather than guessed), NOT a full
catalog crawl — Żabka (a convenience-store chain with ~10k+ physical
locations) has no public online catalog browse; this is the only reachable
source of real Żabka product+price data found during recon. No EAN/GTIN or
separate brand field is present in this markup — `barcode` and `brand` are
left `None`, honestly.

Pure parse() is fixture-testable (no network); fetch_products() is live and
re-fetches zabka.pl's homepage (the entire real feed is this one page — no
pagination/search endpoint was found during recon).
"""
import html as html_lib
import importlib.util
import re
import sys
from decimal import Decimal
from pathlib import Path
from typing import List

_REPO_ROOT = Path(__file__).resolve().parents[3]  # .../Cheep-Scraper
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _load_repo_root_module(name: str, relpath: str):
    """Load a repo-root module by absolute file path under a private key.

    This file lives at countries/poland/scrapers/zabka.py — a directory
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

BASE = "https://www.zabka.pl"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

_TILE_SPLIT_RE = re.compile(r'<div class="product-item">')
_TITLE_RE = re.compile(r'<h3 class="product-item-content__title">(.*?)</h3>', re.S)
_INFO_RE = re.compile(r'product-item-content__informations">(.*?)</p>', re.S)
_PRICE_RE = re.compile(r'product-info__bottom-label">[^<]*<strong>\s*([\d.,]+)\s*z[lł]\s*</strong>', re.S)
_IMAGE_RE = re.compile(r'data-lazy-src="([^"]+)"')
_TAG_RE = re.compile(r'<[^>]+>')


def _strip_tags(text: str) -> str:
    return html_lib.unescape(_TAG_RE.sub(" ", text)).strip()


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or f"h{abs(hash(name))}"


class ZabkaScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Żabka")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Parse a saved zabka.pl homepage (HTML) into Products.

        Splits the page into per-tile chunks on the `<div class=
        "product-item">` marker (1:1 with the visible carousel tiles), then
        within each chunk extracts:
        - name: `<h3 class="product-item-content__title">` (HTML-
          unescaped; entity-encoded apostrophes like `Dunkin&#8217; Donuts`
          are resolved).
        - price: the tile's `product-info__bottom-label` "Najniższa cena w
          ciągu 30 dni: X zł" figure (a single value; never a range in the
          markup observed) — the closest this feed gets to "current price".
          Tiles with NO such label (the carousel shows package size/variant
          info but no price for roughly half its tiles) are skipped rather
          than guessing a price from the unit-price range text.
        - quantity/unit: the `product-item-content__informations` text up
          to its first `;` (the grammage clause, e.g. "335-440 g" before
          the unit-price clause that follows the `;`) via the shared
          quantity/unit parser. Some tiles list a size RANGE across
          variants (e.g. "335-440 g" for "different kinds") — the shared
          parser resolves a range to its upper bound (its normal behavloor
          for any "last number before the unit" match), an approximation
          noted here rather than hidden.
        - image: the tile's own `data-lazy-src` (a concrete, resolved
          absolute cdn.zabka.pl URL — no placeholder tokens).
        - barcode/brand: not present in this markup -> left `None`,
          honestly (title text sometimes embeds a brand name, e.g. "Pizza
          Guseppe Dr.Oetker", but there is no separate structured brand
          field to extract it from reliably).

        Tiles with no price label, or an empty/whitespace name, are
        skipped.
        """
        products: List[Product] = []
        seen_sku = set()
        chunks = _TILE_SPLIT_RE.split(raw_text)[1:]  # drop preamble before first tile
        for chunk in chunks:
            title_match = _TITLE_RE.search(chunk)
            if not title_match:
                continue
            name = html_lib.unescape(_strip_tags(title_match.group(1)))
            if not name or not name.strip():
                continue

            price_match = _PRICE_RE.search(chunk)
            if not price_match:
                continue  # no unambiguous single-value price on this tile
            try:
                price = Decimal(price_match.group(1).replace(",", "."))
            except Exception:
                continue
            if price <= 0:
                continue

            info_match = _INFO_RE.search(chunk)
            grammage_segment = None
            if info_match:
                info_text = _strip_tags(info_match.group(1))
                grammage_segment = info_text.split(";")[0]
            qty, unit = parse_quantity_and_unit(grammage_segment)
            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

            image_match = _IMAGE_RE.search(chunk)
            image_url = image_match.group(1) if image_match else None

            sku = _slugify(name)[:64]
            if sku in seen_sku:
                continue
            seen_sku.add(sku)

            products.append(Product(
                name=name.strip(),
                price=price,
                store="Żabka",
                brand=None,
                barcode=None,
                sku=sku,
                raw_category=None,
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

    def fetch_products(self) -> List[Product]:
        """Live path: plain `requests` GET of zabka.pl's homepage (no
        Playwright/session needed — this is a server-rendered WordPress
        page; the entire real feed is this one page, see module
        docstring)."""
        import requests

        headers = {
            "User-Agent": UA,
            "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        }
        try:
            resp = requests.get(f"{BASE}/", headers=headers, timeout=20)
            resp.raise_for_status()
        except Exception as e:
            raise NotImplementedError(f"PL Żabka: homepage fetch failed: {e}")
        return self.parse(resp.text)

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        # Polish prices use a comma decimal and often a trailing "zł"
        # (e.g. "3,49 zł").
        return Decimal(
            str(price_str).replace("zł", "").replace(",", ".").strip()
        )
