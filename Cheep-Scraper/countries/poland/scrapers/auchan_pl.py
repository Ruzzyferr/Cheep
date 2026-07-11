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

This was originally a curated homepage/offers listing only (~99 products),
not a full category crawl — see Phase 2 below for the full-catalog path.

Phase 2 (2026-07-11) — full-catalog crawl. The original recon (above) flagged
the SPA's per-category browse as hitting a session-bound, CSRF-gated endpoint
"out of scope for the recon budget"; this expansion re-examined that call and
found a plain, unauthenticated path to the real thing:

- `GET /robots.txt` lists the SPA's real sitemaps, including
  `/sitemaps/sitemap-categories-part1.xml` (~4,000 `/categories/<breadcrumb
  slugs>/<retailerCategoryId>` URLs — real per-category browse pages).
  Fetching one of these category pages with plain `requests` returns 200,
  a server-rendered SPA shell whose `window.__INITIAL_STATE__` embeds BOTH a
  genuine `session.csrf.token` AND (crucially) the category's own product
  data (`data.products.catalogue.data.productGroups[].products` id list +
  `data.products.productEntities` — full decorated objects for the first
  batch only). This confirms a plain GET *does* mint a real, usable session
  — but chasing that HTML-embedded state further wasn't necessary: fetching
  the SPA's own JS bundle (`/static/index-*.js`, linked from the category
  page) and grepping its Redux action creators for `webproductpagews` calls
  surfaced the exact API the category page itself calls client-side to
  hydrate/paginate its grid:

    GET /api/webproductpagews/v6/product-pages
        ?retailerCategoryId={id}&maxPageSize={n}&maxProductsToDecorate={n}
        &includeAdditionalPageInfo={bool}&tag=web,category-item
        [&pageToken={token}]

  This is a plain GET — a *different* endpoint from the PUT
  `/api/webproductpagews/v6/products` (bulk basket/cross-sell product
  re-decoration) the original recon flagged as CSRF-gated; that PUT endpoint
  is unrelated to category browsing. Confirmed live: this GET succeeds as
  the very first request of a brand-new `requests.Session()` — no warm-up
  page load and no CSRF header needed at all (the response's own Set-Cookie
  headers mint `VISITORID`/`AWSALB`/`global_sid`). A `requests.Session()` is
  still used throughout the crawl so `pageToken`-based pagination stays
  bound to one cookie jar.
- **Response shape**: `productGroups[].decoratedProducts[]` — flat product
  objects with the SAME field shape as the v5 endpoint's nested `product`
  object (name/brand/price/promoPrice/catchweight/packSizeDescription/
  categoryPath/image/retailerProductId), just not wrapped in a
  `{"productId":.., "product":{...}}` entry — `parse_v6()` below reuses
  `parse()`'s exact field-extraction logic via the shared `_build_product()`
  helper. `metadata.nextPageToken` drives pagination (confirmed live: two
  consecutive pages of the same category share zero product ids; the true
  last page simply omits `nextPageToken`).
- **Page size**: `maxPageSize` (kept equal to `maxProductsToDecorate`, so
  every id in a page is fully decorated — no `otherProductIds` leftovers)
  is caller-controlled up to a server-side cap of 1,000 (tested 1,000 vs.
  2,000 — both returned exactly 1,000 decorated products). `MAX_PAGE_SIZE`
  below uses 500, comfortably under that cap: ~2.9 MB/response for a
  238-product page, ~0.4s to download — bandwidth is not the bottleneck,
  request *count* (each paced by `delay_between_requests`) is, so a large
  page size matters more for politeness than a small one would.
- **Category enumeration**: rather than walking the ~4,000-URL sitemap and
  reducing to leaves (Biedronka's approach), `GET
  /api/webproductpagews/v1/categories?decoration=false&categoryDepth=0` —
  the same taxonomy endpoint the SPA's own nav sidebar calls — returns the
  store's top-level department nodes directly (11 departments, 1.8 KB).
  Querying `v6/product-pages` at a DEPARTMENT level (not a leaf) returns
  that whole subtree's products, not just items directly assigned to the
  department itself: confirmed live for `retailerCategoryId=2578`
  ("Wędliny", a department with 5 child categories) — its
  `currentCategory.productCount` (464) reflects the deduplicated subtree
  total, and a full-page fetch (`maxPageSize=500`) returned exactly 464
  distinct product ids covering all 5 children's items. So crawling just
  the 11 department ids (each paginated via `pageToken`) reaches the FULL
  catalog: confirmed live totals per department (`maxPageSize=1`, just
  reading `currentCategory.productCount`) summed to **25,947** products —
  Zdrowa żywność 2,310 / Artykuły spożywcze 12,964 / Kawa, Herbata i kakao
  1,105 / Alkohole 2,384 / Chemia i środki czystości 1,405 / Higiena i
  kosmetyki 2,429 / Dziecko i Mama 1,117 / Dla zwierząt 1,110 / Artykuły
  biurowe i szkolne 238 / Artykuły dla domu 765 / Auto-Moto 120 — at
  `MAX_PAGE_SIZE=500` that's only ~57 page fetches for the entire store,
  far fewer than a leaf-by-leaf crawl would need.
- `discover_department_ids()` tries the `v1/categories` endpoint first,
  falling back to `FALLBACK_DEPARTMENT_IDS` (the 11 (name, id) pairs
  observed at recon time above) if that call fails or returns nothing —
  same discovery/fallback isolation principle as Biedronka's
  `discover_category_urls()`.
- Per-department fetch errors are isolated (caught, logged, the crawl moves
  on to the next department) so one dead/renamed department can't abort the
  whole run — same principle as Biedronka's per-category isolation, now
  additionally applied across `pageToken` pages within a department.
- Products are deduplicated by `sku` across the *entire* crawl (a global
  `seen_sku` set, not per-department) — first occurrence wins; departments
  are crawled in the order `discover_department_ids()` returns them, so this
  is deterministic run-to-run. `parse_v6()` itself also dedupes by
  `productId` *within* one response (an item can legitimately appear in both
  the `on_offer` and `ungrouped` groups of the same page).
- `fetch_products()` falls back to the original Phase-1 curated v5 homepage
  listing (`_fetch_v5_curated()`) only if the full v6 department crawl comes
  back with zero products entirely (e.g. the v6 endpoint itself becomes
  unreachable) — this scraper can never regress below its original ~99
  product baseline.
- **Domain scope**: unlike Lidl PL (an online general-merchandise shop
  wearing a grocery skin — see lidl_pl.py's `category_allow_prefixes` note),
  Auchan is a real hypermarket: all 11 departments above are genuine
  sections of a physical supermarket (yes, including office supplies, auto
  care, and pet supplies — real aisles, not a separate durable-goods
  storefront), so no ingest-time domain/category filter is added here. See
  the task-19 report for the department-level product-count breakdown a
  future category-mapping pass can use to decide finer-grained inclusion
  (e.g. whether "Auto-Moto"/"Artykuły biurowe i szkolne" belong in a
  grocery price app at all).

Pure `parse()`/`parse_v6()` are fixture-testable (no network); `fetch_products()`
is live and hits the v1/v6 endpoints directly via `requests` (no browser
automation needed).
"""
import importlib.util
import json
import sys
import time
from decimal import Decimal
from pathlib import Path
from typing import List, Optional, Tuple
from urllib.parse import urlencode

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
CATEGORIES_URL = f"{BASE}/api/webproductpagews/v1/categories"
CATALOGUE_URL = f"{BASE}/api/webproductpagews/v6/product-pages"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

DEFAULT_LIMIT = 100  # only used by the Phase-1 v5 curated-listing fallback

MAX_PAGE_SIZE = 500              # products per v6 catalogue page (server caps at 1000; see docstring)
MAX_PAGES = 200                  # hard cap: total v6 page fetches per run
MAX_PAGES_PER_DEPARTMENT = 40    # hard cap: pages within a single department (crawler-trap guard)

# The store's 11 top-level departments, observed live 2026-07-11 (see module
# docstring) — last-resort fallback if the v1/categories discovery call
# fails or returns nothing.
FALLBACK_DEPARTMENT_IDS = [
    ("Zdrowa żywność", "3177"),
    ("Artykuły spożywcze", "2091"),
    ("Kawa, Herbata i kakao", "4324"),
    ("Alkohole", "3639"),
    ("Chemia i środki czystości", "3691"),
    ("Higiena i kosmetyki", "3842"),
    ("Dziecko i Mama", "4355"),
    ("Dla zwierząt", "6086"),
    ("Artykuły biurowe i szkolne", "2924"),
    ("Artykuły dla domu", "4131"),
    ("Auto-Moto", "4057"),
]


class AuchanPLScraper(BaseScraper):
    def __init__(self):
        super().__init__(store_name="Auchan")

    @staticmethod
    def _build_product(item: dict, product_id: Optional[str]) -> Optional[Product]:
        """Pure: turn one raw product dict into a `Product`, or `None` if it
        has no usable name/price. Shared by `parse()` (the v5 endpoint's
        nested `entry["product"]` object) and `parse_v6()` (the v6
        endpoint's flat `decoratedProducts[]` entries) — both endpoints
        emit the identical field shape for an individual product (see
        module docstring):
        - name: `name`.
        - brand: `brand` (may be absent for some listings).
        - price: `promoPrice.amount` when present (the price the shopper
          actually pays under an active promo), else `price.amount`.
          `original_price` is `price.amount` when a promoPrice makes it
          differ.
        - quantity/unit: `type == "CATCHWEIGHT"` items (loose produce/deli
          sold by weight) give a real total via
          `catchweight.typicalQuantity` (value + uom, e.g. {"value": "4",
          "uom": "KG"}) rather than the min-max range string in
          `packSizeDescription` (e.g. "3000g - 99999g", which is a bound
          not a size). Other items use `packSizeDescription` (e.g. "1L",
          "0.084kg") via the shared quantity/unit parser; items with
          neither (occasionally a piece-priced item like "sztuka") fall
          back to the parser's (1.0, "adet") default.
        - barcode: no EAN/GTIN field is present in this payload shape (the
          storefront's product cards don't expose it) -> left None,
          honestly.
        - sku: `retailerProductId` (falls back to `productId`/`name`).
        - category: last entry of `categoryPath` (deepest category).
        - image: `image.src`.
        """
        name = item.get("name")
        if not name or not str(name).strip():
            return None

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
            return None
        if price <= 0:
            return None

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

        sku = str(item.get("retailerProductId") or product_id or name)[:64]

        return Product(
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
        )

    @staticmethod
    def parse(raw_text: str) -> List[Product]:
        """Parse a saved `v5/product-pages` payload (JSON object) into
        Products (see countries/poland/fixtures/auchan_pl_sample.json).

        Real field paths observed in the fixture (each `productGroups[].
        products[]` entry is `{"productId": ..., "product": {...}}`) — see
        `_build_product()` for the shared per-product field mapping.

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
                prod = AuchanPLScraper._build_product(item, product_id)
                if prod is None:
                    continue
                if product_id:
                    seen_ids.add(product_id)
                products.append(prod)
        return products

    @staticmethod
    def parse_v6(raw_text: str) -> List[Product]:
        """Parse a saved `v6/product-pages` catalogue-crawl response (see
        module docstring's Phase 2 recon and
        countries/poland/fixtures/auchan_pl_v6_sample.json) into Products.

        `productGroups[].decoratedProducts[]` are flat product dicts — the
        SAME field shape `_build_product()` already handles for `parse()`,
        just not wrapped in a `{"productId":.., "product":{...}}` entry.
        Deduplicates by `productId` within this one response (an item can
        legitimately appear in both the `on_offer` and `ungrouped` groups
        of the same page). Malformed JSON / missing `productGroups` -> [].
        """
        try:
            data = json.loads(raw_text)
        except (ValueError, TypeError):
            return []
        if not isinstance(data, dict):
            return []
        groups = data.get("productGroups") or []
        products: List[Product] = []
        seen_ids = set()
        for group in groups:
            for item in group.get("decoratedProducts") or []:
                if not isinstance(item, dict):
                    continue
                product_id = item.get("productId")
                if product_id and product_id in seen_ids:
                    continue
                prod = AuchanPLScraper._build_product(item, product_id)
                if prod is None:
                    continue
                if product_id:
                    seen_ids.add(product_id)
                products.append(prod)
        return products

    @staticmethod
    def _extract_department_ids(raw_text: str) -> List[Tuple[str, str]]:
        """Pure: parse a `v1/categories?decoration=false&categoryDepth=0`
        response (see countries/poland/fixtures/auchan_pl_categories_sample.json)
        into a list of `(name, retailerCategoryId)` pairs for the store's
        top-level departments. Malformed/empty input -> []."""
        try:
            data = json.loads(raw_text)
        except (ValueError, TypeError):
            return []
        if not isinstance(data, list):
            return []
        out: List[Tuple[str, str]] = []
        for node in data:
            if not isinstance(node, dict):
                continue
            rid = node.get("retailerCategoryId")
            if not rid:
                continue
            name = node.get("name")
            out.append((str(name) if name else str(rid), str(rid)))
        return out

    @staticmethod
    def _extract_next_page_token(raw_text: str) -> Optional[str]:
        """Pure: read `metadata.nextPageToken` from a v6/product-pages
        response — the pagination loop's stop condition. Missing/malformed
        -> None (treated as "no more pages", the safe default: better to
        under-page a malformed response than loop forever on it)."""
        try:
            data = json.loads(raw_text)
        except (ValueError, TypeError):
            return None
        if not isinstance(data, dict):
            return None
        token = (data.get("metadata") or {}).get("nextPageToken")
        return token if isinstance(token, str) and token else None

    def discover_department_ids(self, fetch) -> List[Tuple[str, str]]:
        """Live: dynamically discover the store's top-level department ids
        via `v1/categories?decoration=false&categoryDepth=0` — the same
        taxonomy endpoint the SPA's own nav sidebar calls. `fetch(url) ->
        str | None` is injected (the real requests-backed implementation
        lives in fetch_products() below) so this method has no direct
        network dependency and stays unit-testable with a stub.

        Falls back to `FALLBACK_DEPARTMENT_IDS` (the 2026-07-11 recon
        snapshot) if the call fails or returns nothing."""
        try:
            raw = fetch(f"{CATEGORIES_URL}?decoration=false&categoryDepth=0")
            if raw:
                depts = self._extract_department_ids(raw)
                if depts:
                    self.logger.info(f"discovered {len(depts)} top-level departments")
                    return depts
        except Exception as e:
            self.logger.warning(f"department discovery failed: {e}")

        self.logger.warning(
            "dynamic department discovery failed entirely; falling back to the "
            f"{len(FALLBACK_DEPARTMENT_IDS)}-department 2026-07-11 recon snapshot"
        )
        return list(FALLBACK_DEPARTMENT_IDS)

    def fetch_products(self, department_ids: Optional[List[Tuple[str, str]]] = None) -> List[Product]:
        """Live path: crawl the full catalogue via the v6/product-pages
        endpoint (see module docstring), one department at a time, paginated
        via `pageToken`. Politely delays `self.delay_between_requests`
        seconds before every request after the first; isolates errors per
        department (and per page within a department) so one dead
        department can't abort the whole crawl; deduplicates by `sku`
        globally across the entire run (first occurrence wins).

        Falls back to the original Phase-1 curated v5 homepage listing
        (`_fetch_v5_curated()`) only if the full v6 crawl returns zero
        products entirely — this scraper can never regress below its
        original ~99-product baseline."""
        import requests

        headers = {
            "User-Agent": UA,
            "Accept": "application/json",
            "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        }
        session = requests.Session()
        state = {"first_request": True}

        def _get(url: str) -> Optional[str]:
            if not state["first_request"]:
                time.sleep(self.delay_between_requests)
            state["first_request"] = False
            resp = session.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            # Decode .content explicitly (zabka.py-style hardening against a
            # server that omits/mis-declares its charset).
            return resp.content.decode("utf-8", errors="replace")

        if department_ids is None:
            department_ids = self.discover_department_ids(_get)

        seen_sku = set()
        products: List[Product] = []
        pages_fetched = 0

        for name, dept_id in department_ids:
            if pages_fetched >= MAX_PAGES:
                self.logger.warning(
                    f"MAX_PAGES ({MAX_PAGES}) safety cap reached; stopping crawl early "
                    f"with {len(products)} products from {pages_fetched} pages"
                )
                break
            try:
                page_token: Optional[str] = None
                dept_pages = 0
                while True:
                    params = [
                        ("retailerCategoryId", dept_id),
                        ("maxProductsToDecorate", str(MAX_PAGE_SIZE)),
                        ("maxPageSize", str(MAX_PAGE_SIZE)),
                        ("includeAdditionalPageInfo", "false"),
                        ("tag", "web,category-item"),
                    ]
                    if page_token:
                        params.append(("pageToken", page_token))
                    raw = _get(f"{CATALOGUE_URL}?{urlencode(params)}")
                    pages_fetched += 1
                    dept_pages += 1

                    parsed = self.parse_v6(raw)
                    for prod in parsed:
                        if prod.sku in seen_sku:
                            continue
                        seen_sku.add(prod.sku)
                        products.append(prod)

                    next_token = self._extract_next_page_token(raw)
                    if (not next_token or not parsed
                            or dept_pages >= MAX_PAGES_PER_DEPARTMENT
                            or pages_fetched >= MAX_PAGES):
                        break
                    page_token = next_token
            except Exception as e:
                self.logger.warning(f"department '{name}' ({dept_id}) fetch failed: {e}")
                continue

        if not products:
            self.logger.warning(
                "v6 catalogue crawl returned 0 products; falling back to the "
                "Phase-1 curated v5 homepage listing"
            )
            try:
                return self._fetch_v5_curated(session, headers)
            except Exception as e:
                raise NotImplementedError(f"PL Auchan: full crawl AND v5 fallback both failed: {e}")

        return products

    def _fetch_v5_curated(self, session, headers: dict, limit: int = DEFAULT_LIMIT) -> List[Product]:
        """The original Phase-1 path: the unauthenticated curated
        homepage/offers listing (see module docstring's original recon).
        Used only as a last-resort fallback if the full v6 department crawl
        returns zero products."""
        params = [("decoratedOnly", "true"), ("limit", str(limit)), ("tag", "web"), ("tag", "lohp")]
        resp = session.get(PRODUCT_PAGES_URL, headers=headers, params=params, timeout=20)
        resp.raise_for_status()
        return self.parse(resp.text)

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        # Polish prices use a comma decimal and often a trailing "zł"
        # (e.g. "3,49 zł").
        return Decimal(
            str(price_str).replace("zł", "").replace(",", ".").strip()
        )
