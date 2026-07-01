"""Kaufland (Germany) scraper — anchor, currently blocked.

Recon (2026-07-02): `requests.get("https://www.kaufland.de/", ...)` returns
403; the body is a Cloudflare bot-check challenge page titled "Kaufland.de -
Verifizierung erforderlich" whose own "Technische Hinweise" (technical notes)
section literally reads "WAF Challenge" / "Bot protection". Driving a real
headless Chromium session via Playwright hit the identical Cloudflare
interstitial — page title "Nur einen Moment…", reproduced again on a reload
of the same page — so this is a genuine edge/WAF-level bot-check, not a
one-off fluke. No product JSON/HTML was retrievable, so no fixture was
captured and none is fabricated here.

`parse()` is written defensively against the JSON shape Kaufland's storefront
product-listing APIs commonly expose (name/price/unit/GTIN fields), mirroring
the SE Willys / CH Coop dual-path pattern — but it is UNVERIFIED against a
real Kaufland payload (no live sample was reachable). Treat it as a starting
point to correct once recon succeeds (e.g. via a residential proxy or
anti-bot service), not as confirmed-working code. `fetch_products()`
intentionally raises `NotImplementedError` so nothing pretends to work
end-to-end while blocked.
"""
import importlib.util
import json
import sys
from decimal import Decimal
from pathlib import Path
from typing import List

_REPO_ROOT = Path(__file__).resolve().parents[3]  # .../Cheep-Scraper
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _load_repo_root_module(name: str, relpath: str):
    """Load a repo-root module by absolute file path (see rewe.py's identical
    helper for why: this file's own directory is also named `scrapers`,
    which collides with the repo-root package of the same name once a test
    harness puts this directory earlier on sys.path)."""
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


class KauflandDEScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Kaufland")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Best-effort parse of a Kaufland product listing payload (JSON
        array or `{"products": [...]}` envelope). UNVERIFIED — no live
        Kaufland fixture was obtainable (see module docstring); field names
        are a reasonable guess pending real recon, not a confirmed contract.
        German prices use a comma decimal (e.g. "1,09 €"), handled by
        parse_price below.
        """
        data = json.loads(raw_text)
        items = data.get("products", data) if isinstance(data, dict) else data
        products: List[Product] = []
        for item in items or []:
            name = item.get("name") or item.get("title")
            price_raw = item.get("price") or item.get("displayPrice")
            if not name or price_raw in (None, ""):
                continue
            # German prices use a comma decimal and often a trailing "€"
            # (e.g. "1,09 €"); strip both before parsing.
            price = Decimal(str(price_raw).replace("€", "").replace(",", ".").strip())
            qty, unit = parse_quantity_and_unit(item.get("unit") or item.get("quantity") or item.get("grammage"))
            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)
            products.append(Product(
                name=str(name).strip(),
                price=price,
                store="Kaufland",
                brand=item.get("brand"),
                barcode=item.get("gtin") or item.get("ean"),
                sku=str(item.get("id") or item.get("sku") or name)[:64],
                raw_category=item.get("category"),
                unit=unit,
                quantity=qty,
                unit_price=unit_price,
                unit_price_unit=unit_price_unit,
                image_url=item.get("image"),
                country_code="DE",
            ))
        return products

    def fetch_products(self) -> List[Product]:
        raise NotImplementedError(
            "DE Kaufland: site unreachable at build time (403 / Cloudflare WAF challenge "
            "on both requests and Playwright headless Chromium) — see config.json note"
        )

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        return Decimal(
            str(price_str).replace("€", "").replace(",", ".").strip()
        )
