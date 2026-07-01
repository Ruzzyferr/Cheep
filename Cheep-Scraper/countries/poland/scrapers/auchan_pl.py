"""Auchan (Poland) scraper — anchor.

Recon (2026-07-02): a plain `requests` GET of https://zakupy.auchan.pl/
returns 200 (real SPA shell, no CDN/WAF block observed — unlike Carrefour PL,
see carrefour_pl.py). Driving that homepage load (even via plain `requests`,
no Playwright/session needed) triggers the SPA's own unauthenticated call to

    GET https://zakupy.auchan.pl/api/webproductpagews/v5/product-pages
        ?decoratedOnly=true&limit={n}&tag=web&tag=lohp

which returns real curated "featured" / "on_offer" / "group" product
listings (name/brand/price/promoPrice/packSizeDescription/catchweight/
categoryPath/image) — this is the real field shape `parse()` below is built
against (see countries/poland/fixtures/auchan_pl_sample.json, captured live
via that exact endpoint+params).

This is a curated homepage/offers listing (raising `limit` widens it, up to
what the endpoint will return), not a full category crawl: the SPA's
per-category catalogue browse hits a *different*, session-bound endpoint
(`/api/webproductpagews/v6/products`, a PUT of specific product ids) that
requires a CSRF token + `client-route-id` minted by the SPA's own JS after a
category navigation — out of scope for the recon budget here. The v5 listing
endpoint is nonetheless real, live, unauthenticated data with genuine
names/brands/package sizes/prices/promos — not fabricated — so `parse()`
maps it honestly rather than pretending to have the full catalog.

Pure parse() is fixture-testable (no network); fetch_products() is live and
hits the v5 endpoint directly via `requests` (no browser automation needed —
unlike ICA/Migros, this endpoint needs no minted token).
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

    This file lives at countries/poland/scrapers/auchan_pl.py — a directory
    ALSO named `scrapers`. Test harnesses that put this country's directory
    ahead of the repo root on sys.path (see tests/test_pl_scrapers.py) cause
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

BASE = "https://zakupy.auchan.pl"
PRODUCT_PAGES_URL = f"{BASE}/api/webproductpagews/v5/product-pages"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

DEFAULT_LIMIT = 100


class AuchanPLScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Auchan")

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Parse a saved `product-pages` payload (JSON object) into Products.

        Real field paths observed in the fixture (each `productGroups[].
        products[]` entry is `{"productId": ..., "product": {...}}`):
        - name: `product.name`.
        - brand: `product.brand` (may be absent for some listings).
        - price: `product.promoPrice.amount` when present (the price the
          shopper actually pays under an active promo), else
          `product.price.amount`. `original_price` is `product.price.amount`
          when a promoPrice makes it differ.
        - quantity/unit: `product.type == "CATCHWEIGHT"` items (loose
          produce/deli sold by weight) give a real total via
          `product.catchweight.typicalQuantity` (value + uom, e.g.
          {"value": "4", "uom": "KG"}) rather than the min-max range string
          in `packSizeDescription` (e.g. "3000g - 99999g", which is a bound
          not a size). Other items use `product.packSizeDescription` (e.g.
          "1L", "0.084kg") via the shared quantity/unit parser; items with
          neither (occasionally a piece-priced item like "sztuka") fall back
          to the parser's (1.0, "adet") default.
        - barcode: no EAN/GTIN field is present in this payload shape (the
          storefront's product cards don't expose it) -> left None, honestly.
        - sku: `product.retailerProductId` (falls back to `productId`).
        - category: last entry of `product.categoryPath` (deepest category).
        - image: `product.image.src`.

        Items with no usable price are skipped.
        """
        data = json.loads(raw_text)
        groups = data.get("productGroups") or []
        products: List[Product] = []
        seen_ids = set()
        for group in groups:
            for entry in group.get("products") or []:
                item = entry.get("product") or {}
                product_id = item.get("productId") or entry.get("productId")
                if product_id and product_id in seen_ids:
                    continue

                name = item.get("name")
                if not name or not str(name).strip():
                    continue

                promo_price = (item.get("promoPrice") or {}).get("amount")
                base_price = (item.get("price") or {}).get("amount")
                if promo_price not in (None, ""):
                    price = Decimal(str(promo_price))
                    original = (Decimal(str(base_price))
                                if base_price not in (None, "") and Decimal(str(base_price)) != price
                                else None)
                elif base_price not in (None, ""):
                    price = Decimal(str(base_price))
                    original = None
                else:
                    continue
                if price <= 0:
                    continue

                catchweight = item.get("catchweight") or {}
                typical = catchweight.get("typicalQuantity") or {}
                if typical.get("value") not in (None, ""):
                    qty, unit = parse_quantity_and_unit(f"{typical['value']} {typical.get('uom', '')}")
                else:
                    qty, unit = parse_quantity_and_unit(item.get("packSizeDescription"))
                unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

                category_path = item.get("categoryPath") or []
                raw_category = category_path[-1] if category_path else None

                image_url = (item.get("image") or {}).get("src")

                if product_id:
                    seen_ids.add(product_id)

                sku = str(item.get("retailerProductId") or product_id or name)[:64]

                products.append(Product(
                    name=str(name).strip(),
                    price=price,
                    store="Auchan",
                    brand=item.get("brand"),
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

    def fetch_products(self, limit: int = DEFAULT_LIMIT) -> List[Product]:
        """Live path: plain `requests` GET of the unauthenticated
        `product-pages` listing endpoint (no Playwright/session needed —
        this endpoint is reachable directly, unlike ICA/Migros)."""
        import requests

        headers = {
            "User-Agent": UA,
            "Accept": "application/json",
            "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        }
        params = [("decoratedOnly", "true"), ("limit", str(limit)), ("tag", "web"), ("tag", "lohp")]
        try:
            resp = requests.get(PRODUCT_PAGES_URL, headers=headers, params=params, timeout=20)
            resp.raise_for_status()
        except Exception as e:
            raise NotImplementedError(f"PL Auchan: product-pages fetch failed: {e}")
        return self.parse(resp.text)

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        # Polish prices use a comma decimal and often a trailing "zł"
        # (e.g. "3,49 zł").
        return Decimal(
            str(price_str).replace("zł", "").replace(",", ".").strip()
        )
