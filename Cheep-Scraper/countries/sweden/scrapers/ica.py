"""ICA (Sweden) scraper — anchor.

Recon (2026-07-02): a plain `requests` GET of https://www.ica.se/ returns 200
but is the content/recipes site shell (no grocery product data server-side).
Driving a real (headless) Chromium session via Playwright and just loading
that shell already causes the page's own scripts to mint a per-session
Bearer token and call it against the *public* API gateway
`apimgw-pub.ica.se` (no login/store needed for this). Once that token is
known, plain `requests` GETs of

    GET https://apimgw-pub.ica.se/sverige/digx/offerreader/v1/offers/store/{storeId}

return a real JSON array of that store's current offers/campaign listing —
this is the real field shape `parse()` below is built against (see
countries/sweden/fixtures/ica_sample.json, captured live from store 12805,
"ICA Nara Sergels Torg" in Stockholm, via that endpoint).

This is a per-store *offers* listing (discount campaigns), not a full
catalog crawl — ICA's full always-on catalog with plain shelf prices sits
behind `handlaprivatkund.ica.se`, which requires picking a store + often a
session/login before it serves product data, and was out of scope for the
recon budget here. The offers endpoint is nonetheless real, live, per-store
data with genuine names/brands/package sizes/GTINs/prices (in ore-precision
kronor) — not fabricated — so `parse()` maps it honestly rather than
pretending to have the full catalog.

Pure parse() is fixture-testable (no network); fetch_products() is live and
drives Playwright once to mint the Bearer token, then calls the endpoint
directly per store id via `requests`.
"""
import importlib.util
import json
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import List, Optional

_REPO_ROOT = Path(__file__).resolve().parents[3]  # .../Cheep-Scraper
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _load_repo_root_module(name: str, relpath: str):
    """Load a repo-root module by absolute file path under a private key.

    This file lives at countries/sweden/scrapers/ica.py — a directory ALSO
    named `scrapers`. Test harnesses that put this country's directory
    ahead of the repo root on sys.path (see tests/test_se_scrapers.py) cause
    a plain `from scrapers.base_scraper import ...` to resolve `scrapers` to
    *this* local package instead of the repo-root one, raising
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

BASE = "https://www.ica.se"
GATEWAY = "https://apimgw-pub.ica.se/sverige/digx/offerreader/v1"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# Curated store ids confirmed reachable during recon (Stockholm-area ICA
# stores). fetch_products() accepts a caller-supplied list to widen coverage.
DEFAULT_STORE_IDS = [12805, 1265]


class ICAScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="ICA")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Parse a saved `offers/store/{id}` payload (JSON array) into Products.

        Real field paths observed in the fixture:
        - name: `details.name` (short product/offer name, e.g. "Bregott").
        - brand: `details.brand` (often empty string for house-brand/no-brand
          items -> normalized to None).
        - package size / unit: `details.packageInformation` (free text like
          "750 ml", "2 dl", "480-760 g", "8-pack"; parsed with the shared
          quantity/unit parser — ranges resolve to their upper bound, and
          unrecognized pack phrasing like "8-pack" falls back to (1, adet),
          same conservative behaviour the shared parser applies everywhere).
        - price: this endpoint is a discount-campaign listing, not a plain
          price list, so the per-unit price the shopper actually pays under
          the current offer is `discountValue / requirementValue` (e.g.
          "3 for 149 kr" -> 49.67 kr each); when `requirementValue` is 0 the
          mechanic is already a flat per-unit offer price and `discountValue`
          is used directly. Items with no usable discountValue are skipped.
        - original_price: `stores[0].regularPriceFrom` (the shelf price
          before the offer), when present and different from the offer price.
        - barcode: `eans[0].id` (first EAN/GTIN in the article group; a
          single offer can bundle several near-identical EANs, first is
          treated as canonical, mirroring the CH Migros `gtins[0]` approach).
        - sku: top-level `id` (the offer id).
        - category: `category.articleGroupName`.
        - image: `eans[0].image`, falling back to `picture.url`.
        """
        data = json.loads(raw_text)
        items = data if isinstance(data, list) else data.get("offers", [])
        products: List[Product] = []
        for item in items:
            details = item.get("details") or {}
            name = details.get("name")
            if not name or not str(name).strip():
                continue

            discount_value = item.get("discountValue")
            if discount_value in (None, ""):
                continue
            discount_value = Decimal(str(discount_value))
            requirement_value = item.get("requirementValue") or 0
            requirement_value = Decimal(str(requirement_value))

            if requirement_value > 0:
                price = (discount_value / requirement_value).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                price = discount_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if price <= 0:
                continue

            stores = item.get("stores") or []
            store_info = stores[0] if stores else {}
            reg_from = store_info.get("regularPriceFrom")
            original = None
            if reg_from not in (None, "", 0, 0.0):
                reg_dec = Decimal(str(reg_from))
                if reg_dec != price:
                    original = reg_dec

            eans = item.get("eans") or []
            barcode = str(eans[0]["id"]) if eans and eans[0].get("id") else None

            image_url = None
            if eans and eans[0].get("image"):
                image_url = eans[0]["image"]
            else:
                image_url = (item.get("picture") or {}).get("url")

            brand = (details.get("brand") or "").strip() or None
            category = item.get("category") or {}
            raw_category = category.get("articleGroupName")

            qty, unit = parse_quantity_and_unit(details.get("packageInformation"))
            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

            sku = str(item.get("id") or name)[:64]

            products.append(Product(
                name=str(name).strip(),
                price=price,
                store="ICA",
                brand=brand,
                barcode=barcode,
                sku=sku,
                raw_category=raw_category,
                unit=unit,
                quantity=qty,
                unit_price=unit_price,
                unit_price_unit=unit_price_unit,
                original_price=original,
                image_url=image_url,
                product_url=None,
                country_code="SE",
            ))
        return products

    def fetch_products(self, store_ids: Optional[List[int]] = None) -> List[Product]:
        """Live path: drive a headless browser through the ICA homepage so
        the page's own scripts mint a Bearer token against apimgw-pub.ica.se,
        capture that token, then call the per-store offers endpoint directly
        via `requests` for each store id. Requires Playwright/Chromium.
        """
        import requests
        from playwright.sync_api import sync_playwright

        store_ids = store_ids or DEFAULT_STORE_IDS
        token = None
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(user_agent=UA, locale="sv-SE")
            page = ctx.new_page()

            def on_resp(r, _self=self):
                nonlocal token
                if token is None and "apimgw-pub.ica.se" in r.url:
                    auth = r.request.headers.get("authorization")
                    if auth:
                        token = auth
            page.on("response", on_resp)
            try:
                page.goto(f"{BASE}/", wait_until="networkidle", timeout=20000)
                page.wait_for_timeout(1500)
            except Exception as e:
                self.logger.warning(f"ICA homepage navigation failed: {e}")
            browser.close()

        if not token:
            raise NotImplementedError(
                "ICA: could not mint a Bearer token for apimgw-pub.ica.se via Playwright"
            )

        seen_sku = set()
        products: List[Product] = []
        headers = {"User-Agent": UA, "Authorization": token, "Accept-Language": "sv-SE"}
        for store_id in store_ids:
            try:
                resp = requests.get(f"{GATEWAY}/offers/store/{store_id}", headers=headers, timeout=15)
                resp.raise_for_status()
            except Exception as e:
                self.logger.warning(f"store {store_id} fetch failed: {e}")
                continue
            for prod in self.parse(resp.text):
                if prod.sku in seen_sku:
                    continue
                seen_sku.add(prod.sku)
                products.append(prod)
            self.logger.info(f"store {store_id}: total {len(products)}")
        return products

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        return Decimal(
            str(price_str).replace("kr", "").replace(":", ".").replace(",", ".").strip()
        )
