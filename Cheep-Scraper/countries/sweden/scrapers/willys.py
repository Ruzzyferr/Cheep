"""Willys (Sweden, Axfood) scraper — anchor, currently blocked.

Recon (2026-07-02): `requests.get("https://www.willys.se/", ...)` returns a
403 whose body is an Amazon CloudFront error page: "The Amazon CloudFront
distribution is configured to block access from your country." Driving a
real headless Chromium session via Playwright to the same URL hit the
identical CloudFront 403 geo-block page (same static error HTML, no
challenge/CAPTCHA assets, no app shell) — this is an edge/CDN-level
geographic block on the requesting egress, not a bot-fingerprint check, so a
different browser/automation profile would not change the outcome from this
egress location. No product JSON/HTML was retrievable, so no fixture was
captured and none is fabricated here.

`parse()` is written defensively against the JSON shape Axfood's storefront
APIs commonly expose (name/price/unit/GTIN fields, mirroring the ICA/Coop CH
dual-path pattern) but it is UNVERIFIED against a real Willys payload — no
live sample was reachable. Treat it as a starting point to correct once
recon succeeds (e.g. via an SE-based egress), not as confirmed-working code.
`fetch_products()` intentionally raises `NotImplementedError` so nothing
pretends to work end-to-end while blocked.
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
    """Load a repo-root module by absolute file path (see ica.py's identical
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


class WillysScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Willys")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Best-effort parse of a Willys product listing payload (JSON array
        or `{"products": [...]}` envelope). UNVERIFIED — no live Willys
        fixture was obtainable (see module docstring); field names are a
        reasonable guess pending real recon, not a confirmed contract.
        """
        data = json.loads(raw_text)
        items = data.get("products", data) if isinstance(data, dict) else data
        products: List[Product] = []
        for item in items or []:
            name = item.get("name") or item.get("title")
            price_raw = item.get("price") or item.get("displayPrice")
            if not name or price_raw in (None, ""):
                continue
            price = Decimal(str(price_raw))
            qty, unit = parse_quantity_and_unit(item.get("unit") or item.get("quantity") or item.get("jamforpris"))
            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)
            products.append(Product(
                name=str(name).strip(),
                price=price,
                store="Willys",
                brand=item.get("brand"),
                barcode=item.get("gtin") or item.get("ean"),
                sku=str(item.get("id") or item.get("sku") or name)[:64],
                raw_category=item.get("category"),
                unit=unit,
                quantity=qty,
                unit_price=unit_price,
                unit_price_unit=unit_price_unit,
                image_url=item.get("image"),
                country_code="SE",
            ))
        return products

    def fetch_products(self) -> List[Product]:
        raise NotImplementedError(
            "SE Willys: site unreachable at build time (CloudFront 403 'blocked access "
            "from your country' on both requests and Playwright headless Chromium from "
            "this egress) — see config.json note"
        )

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        return Decimal(
            str(price_str).replace("kr", "").replace(":", ".").replace(",", ".").strip()
        )
