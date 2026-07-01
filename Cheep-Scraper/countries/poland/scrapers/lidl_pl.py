"""Lidl (Poland) scraper.

Recon (2026-07-02): a plain `requests` GET of `https://www.lidl.pl/` and of a
CMS category hub page (e.g. `https://www.lidl.pl/c/zywnosc-i-napoje/s10068374`)
both return 200, but are Nuxt-SSR *content* pages (teaser sliders, coupon
banners, video sections — `AWebPriceData`/`ATeaserSlider`/`AShopTheLook`
component CSS) with no product grid/prices server-rendered; driving the
category hub through headless Playwright captured no product-listing XHR
either (confirmed no network product/price/search API calls fired). Lidl
Poland does not appear to operate an online-grocery-with-delivery catalog
under lidl.pl (`onlineAvailable`/`online` flags below are `false` for every
grocery item observed) — this matches Lidl PL's known real-world offering of
weekly leaflet ("gazetka") pricing plus a general/durable-goods shop.

However: `https://www.lidl.pl/q/search?q=<term>` (the site's own search
page) IS server-rendered with a genuine embedded Nuxt payload —
`<script type="application/json" data-nuxt-data="nuxt-app" data-ssr="true"
id="__NUXT_DATA__">` — containing this week's real leaflet/shelf prices for
matching products (title, brand, price, currency, package size, category,
image), reachable via plain `requests` (no Playwright needed). This is the
real field shape `parse()` below is built against (see
countries/poland/fixtures/lidl_pl_sample.json, a live capture of
`/q/search?q=mleko`).

Nuxt's SSR payload format ("devalue") flattens the whole page's reactive
state into ONE top-level JSON array; every object's *values* are integer
indices back into that same array (deduplicating repeated strings/objects),
not the literal values — `_ref()` below resolves one such hop at a time
(following `ShallowReactive`/`Reactive`/`Ref`/`ShallowReactive` wrapper
indirection automatically), and callers hop again for nested objects
(price -> price-object -> numeric price, two hops).

No EAN/GTIN field is present on grocery ("Food") product records in this
payload (only a non-EAN internal "ians" code) — confirmed by inspecting
every food candidate in the fixture. A `gs1`/`ean` field DOES exist, but
only on Lidl's general/durable-goods ("NonFood") catalog items (e.g. a
SILVERCREST kitchen appliance) elsewhere in the same payload — out of scope
for a grocery price-comparison scraper, so this scraper does not surface it
(`barcode` stays `None`, honestly, for every product it emits).

Pure parse() is fixture-testable (no network); fetch_products() is live and
walks a curated list of search terms via plain `requests` (a search-driven
crawl mirrors Migros CH's approach, since Lidl PL's catalog is also
search/CMS driven rather than category-browsable).
"""
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

    This file lives at countries/poland/scrapers/lidl_pl.py — a directory
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

BASE = "https://www.lidl.pl"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

_NUXT_DATA_RE = re.compile(
    r'<script type="application/json" data-nuxt-data="nuxt-app" data-ssr="true" '
    r'id="__NUXT_DATA__"[^>]*>(.*?)</script>',
    re.S,
)

_REACTIVE_WRAPPERS = {"ShallowReactive", "Reactive", "Ref", "ShallowRef"}

# Curated grocery search terms — broad coverage across canonical categories
# (mirrors Migros CH's search-driven approach; Lidl PL's own site search is
# the only reachable source of real current prices, see module docstring).
SEARCH_TERMS = [
    "mleko", "ser", "jogurt", "jajka", "maslo", "smietana",
    "kurczak", "wolowina", "wedlina", "szynka", "ryba",
    "pomidory", "ogorki", "ziemniaki", "cebula", "jablka", "banany",
    "ryz", "makaron", "maka", "cukier", "sol", "olej",
    "woda", "sok", "kawa", "herbata",
    "czekolada", "ciastka", "chipsy",
    "chleb", "bulka",
]


def _ref(data: list, value):
    """Resolve one devalue-array hop: if `value` is an int index into
    `data`, return `data[value]` (following one level of reactive-wrapper
    indirection, e.g. `["ShallowReactive", 123]` -> `data[123]`); otherwise
    return `value` unchanged (it was already a literal)."""
    if isinstance(value, int) and 0 <= value < len(data):
        resolved = data[value]
        if (isinstance(resolved, list) and len(resolved) == 2
                and isinstance(resolved[0], str) and resolved[0] in _REACTIVE_WRAPPERS):
            return _ref(data, resolved[1])
        return resolved
    return value


class LidlPLScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Lidl")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Parse a saved Nuxt `__NUXT_DATA__` payload (a flattened JSON
        array — see module docstring for the devalue reference format) into
        Products.

        Candidate product records are dict entries in the array that carry
        `price`/`title`/`itemId` keys together (the search-result product
        card shape). For each candidate:
        - name: `fullTitle` (fuller display string, e.g. "PILOS Mleko UHT
          3,2% Mleczna Krowa"), falling back to `title`.
        - brand: `brand.name`.
        - price: `price.price` (current price the shopper pays this week);
          `price.oldPrice` is the pre-promo reference price when it's a
          positive number that differs (a `0` `oldPrice` means "not
          discounted", not "free" — the real GS1/EU Omnibus-style zero
          sentinel this payload uses, not a genuine price).
        - quantity/unit: `price.packaging.text` (e.g. "1 L", "500 g") via
          the shared quantity/unit parser.
        - category: `category` ("Food"/"NonFood" in this payload).
        - image: `image` (a concrete, already-resolved absolute CDN URL —
          no placeholder tokens observed, unlike Migros CH's `{stack}`).
        - sku: `erpNumber` (falls back to `itemId`).
        - barcode: intentionally left `None` for every product — see module
          docstring (no EAN on food items in this payload).

        Candidates with no positive current price are skipped.
        """
        data = json.loads(raw_text)
        products: List[Product] = []
        seen_sku = set()
        for item in data:
            if not isinstance(item, dict):
                continue
            if not {"price", "title", "itemId"}.issubset(item.keys()):
                continue

            price_obj = _ref(data, item.get("price"))
            if not isinstance(price_obj, dict):
                continue
            price_val = _ref(data, price_obj.get("price"))
            if price_val in (None, "") :
                continue
            try:
                price = Decimal(str(price_val))
            except Exception:
                continue
            if price <= 0:
                continue

            name = _ref(data, item.get("fullTitle")) or _ref(data, item.get("title"))
            if not name or not str(name).strip():
                continue

            old_price_val = _ref(data, price_obj.get("oldPrice"))
            original = None
            if old_price_val not in (None, ""):
                try:
                    old_price = Decimal(str(old_price_val))
                    if old_price > 0 and old_price != price:
                        original = old_price
                except Exception:
                    original = None

            brand_obj = _ref(data, item.get("brand"))
            brand = None
            if isinstance(brand_obj, dict):
                brand = _ref(data, brand_obj.get("name"))

            packaging_obj = _ref(data, price_obj.get("packaging"))
            packaging_text = None
            if isinstance(packaging_obj, dict):
                packaging_text = _ref(data, packaging_obj.get("text"))
            qty, unit = parse_quantity_and_unit(packaging_text if isinstance(packaging_text, str) else None)
            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

            raw_category = _ref(data, item.get("category"))
            if not isinstance(raw_category, str):
                raw_category = None

            image = _ref(data, item.get("image"))
            image_url = image if isinstance(image, str) and image.startswith("http") else None

            erp = _ref(data, item.get("erpNumber"))
            item_id = _ref(data, item.get("itemId"))
            sku = str(erp or item_id or name)[:64]
            if sku in seen_sku:
                continue
            seen_sku.add(sku)

            products.append(Product(
                name=str(name).strip(),
                price=price,
                store="Lidl",
                brand=brand if isinstance(brand, str) else None,
                barcode=None,
                sku=sku,
                raw_category=raw_category,
                unit=unit,
                quantity=qty,
                unit_price=unit_price,
                unit_price_unit=unit_price_unit,
                original_price=original,
                image_url=image_url,
                product_url=None,
                country_code="PL",
            ))
        return products

    def fetch_products(self, terms: Optional[List[str]] = None) -> List[Product]:
        """Live path: plain `requests` GET of each search term's page,
        extracting the server-rendered `__NUXT_DATA__` payload (no
        Playwright/session needed — this endpoint is reachable directly,
        unlike ICA/Migros)."""
        import requests

        headers = {
            "User-Agent": UA,
            "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        }
        terms = terms or SEARCH_TERMS
        seen_sku = set()
        products: List[Product] = []
        for term in terms:
            try:
                resp = requests.get(f"{BASE}/q/search", params={"q": term}, headers=headers, timeout=20)
                resp.raise_for_status()
            except Exception as e:
                self.logger.warning(f"'{term}' search fetch failed: {e}")
                continue
            match = _NUXT_DATA_RE.search(resp.text)
            if not match:
                self.logger.warning(f"'{term}': no __NUXT_DATA__ payload found")
                continue
            for prod in self.parse(match.group(1)):
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
