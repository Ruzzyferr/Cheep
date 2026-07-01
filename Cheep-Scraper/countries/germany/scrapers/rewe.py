"""REWE (Germany) scraper — anchor, currently blocked.

Recon (2026-07-02): `requests.get("https://shop.rewe.de/", ...)` returns 403
(a Cloudflare WAF block on plain HTTP, no browser JS execution). Driving a
real headless Chromium session via Playwright gets past that initial layer —
the actual SPA shell loads fine (200, title "Lebensmittel online bestellen im
REWE Onlineshop"), and the PLZ/market-selection flow is genuinely reachable:

    GET https://www.rewe.de/api/marketselection/zipcodes/{plz}
    GET https://www.rewe.de/api/marketselection/zipcodes/{plz}/services
    GET https://www.rewe.de/api/marketselection/zipcodes/{plz}/services/pickup
    GET https://www.rewe.de/api/timeslots/pickup/{marketId}/next-bookable

all returned real 200 JSON for PLZ 50667 (Köln). But REWE requires a
delivery/pickup market context before it will serve product data, and
committing that market selection (`POST .../userselections`), or even just
following the "Zu den Marktangeboten" (offers) link into a category, triggers
a Cloudflare Turnstile interstitial ("Nur einen Moment…" / "Zeig uns, dass du
ein Mensch bist") in the large majority of attempts (roughly 1 in 10 runs
slipped through to `GET /shop/api/category-search`, but that endpoint is
category-*navigation* metadata only — id/name/link/productCount — not
product/price/barcode data). No real per-product JSON was retrievable within
the recon budget, so no fixture was captured and none is fabricated here.

`parse()` is written defensively against the JSON shape REWE's storefront
product-listing APIs commonly expose (name/price/unit/GTIN fields), mirroring
the SE Willys / CH Coop dual-path pattern — but it is UNVERIFIED against a
real REWE product payload (only category-navigation metadata was reachable,
not a product listing). Treat it as a starting point to correct once recon
succeeds (e.g. via a residential proxy or anti-bot service), not as
confirmed-working code. `fetch_products()` intentionally raises
`NotImplementedError` so nothing pretends to work end-to-end while blocked.
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
    """Load a repo-root module by absolute file path.

    This file lives at countries/germany/scrapers/rewe.py — a directory ALSO
    named `scrapers`. Test harnesses that put this country's directory ahead
    of the repo root on sys.path (see tests/test_de_scrapers.py) cause a
    plain `from scrapers.base_scraper import ...` to resolve `scrapers` to
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


class REWEScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="REWE")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Best-effort parse of a REWE product listing payload (JSON array or
        `{"products": [...]}` envelope). UNVERIFIED — no live REWE product
        fixture was obtainable (see module docstring); field names are a
        reasonable guess pending real recon, not a confirmed contract.
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
                store="REWE",
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
            "DE REWE: product listings unreachable at build time (Cloudflare Turnstile "
            "challenge on committing a market selection / browsing offer categories via "
            "Playwright headless Chromium, in the large majority of attempts) — see "
            "config.json note"
        )

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        return Decimal(
            str(price_str).replace("€", "").replace(",", ".").strip()
        )
