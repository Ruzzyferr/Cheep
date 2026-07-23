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

Pure parse() is fixture-testable (no network).

Phase 2 (2026-07-11): expanded fetch_products() from the Phase-1 pilot's 7
hardcoded category-listing URLs (~36 products) to a dynamically discovered,
paginated crawl of the full storefront catalog. Recon for this expansion:

- `GET /sitemap_index.xml` -> one child sitemap, `/sitemap_0.xml`
  (~2600 <loc> entries live: ~2170 product detail pages, each ending in a
  10-digit-id `.html`, and ~400 non-product pages). Filtering the
  non-product entries down to paths whose FIRST segment is one of the 13
  slugs that recur with sub-paths in the sitemap (`nabial`, `warzywa`,
  `owoce`, `mieso`, `napoje`, `drogeria`, `dla-domu`, `dla-dzieci`,
  `dla-zwierzat`, `mrozone`, `piekarnia`, `artykuly-spozywcze`,
  `dania-gotowe` — DEPARTMENT_PREFIXES below) yields ~300 real
  category-tree URLs. Every other top-level segment observed
  (`promocje-*`, numbered merchandising buckets like `strefa-fit-1`/`-2`/
  `-3`, `bestsellery-2`, `home`, `regulaminy`, `polecane`, ...) appears
  exactly once in the sitemap with no children — a one-off promo/landing
  page, not a category — and is excluded.
  Reducing that ~300 to leaf nodes only (no other discovered category URL
  nests under it) gives ~244 category-listing pages to actually crawl.
  Crawling leaves only (not every parent/department "aggregate" page too)
  avoids redundantly re-fetching the same products through their ancestor
  pages while still reaching the full catalog: each product's
  `raw_category` is read from its own per-tile `data-product-gtm` payload
  (see below), not from which URL it happened to be fetched through, so
  nothing is lost by skipping the aggregate parents.
- Category-listing pages paginate via a `?page=N` query parameter
  (confirmed live: `/napoje/?page=2` and `/napoje/?page=3` return a
  different, non-overlapping set of `data-itemid`s than page 1 and than
  each other; a `?start=`/`?sz=` SFCC-style offset param, tried first
  since it's the more common Demandware convention, was silently ignored
  by the server and just re-served page 1 — `?page=N` is the one that
  actually works here). Each page's product grid embeds
  `<ul class="product-grid ... data-has-next="true|false">` — the loop's
  stop condition — plus a `<span class="refinements__total-items">N
  produkty</span>` total-count (logged, not relied on for the loop).
  Fetching past the real last page (e.g. `?page=4` when only 3 exist) is
  safe and idempotent — the server just re-serves the last page with
  `data-has-next="false"` — so the loop isn't fragile to an off-by-one;
  it's additionally guarded by MAX_PAGES_PER_CATEGORY and a global
  MAX_PAGES cap against a hypothetical crawler trap (a category page that
  always reports `data-has-next="true"`).
- discover_category_urls() tries, in order: (a) the sitemap path above,
  (b) a homepage-nav-link fallback (`https://zakupy.biedronka.pl/`'s own
  `<a href>` menu, which only surfaces ~2 levels of the category tree —
  no "earl-grey-tea"-style leaves — so it's strictly worse than the
  sitemap and used only if the sitemap is unreachable/empty), (c) the
  original Phase-1 hardcoded 7-URL list (FALLBACK_CATEGORY_URLS), if both
  dynamic sources fail outright. Each stage is a pure, fixture-testable
  parsing function (`_extract_sitemap_locs` / `_filter_category_urls` /
  `_reduce_to_leaves` / `_extract_nav_category_urls` /
  `_extract_pagination_info`) fed by a small injected `fetch(url)`
  callable, so discovery logic is unit-testable without a live network
  call — only the real `fetch_products()` wires it to `requests`.
- Per-category fetch errors are isolated (caught, logged, the crawl moves
  on to the next category) so one dead/renamed category can't abort the
  whole run — same principle as the Phase-1 per-URL try/except, now also
  applied across pagination pages within a category.
- Products are deduplicated by `sku` across the *entire* crawl (a global
  `seen_sku` set, not per-category) since the same product legitimately
  appears under multiple categories (e.g. a flavoured water under both
  `napoje/woda/` and `napoje/woda/smakowa/`) — first occurrence wins,
  keeping whichever category's page happened to be crawled first
  (category URLs are crawled in sorted order, so this is deterministic
  run-to-run); its `raw_category` is simply whatever that particular tile
  reported, not re-derived from the URL.
"""
import html
import importlib.util
import json
import re
import sys
import time
from decimal import Decimal
from pathlib import Path
from typing import List, Optional, Tuple

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

# The only sitemap top-level path segments that recur with sub-paths (real
# department roots) as of the 2026-07-11 recon; see module docstring.
DEPARTMENT_PREFIXES = frozenset({
    "nabial", "warzywa", "owoce", "mieso", "napoje", "drogeria",
    "dla-domu", "dla-dzieci", "dla-zwierzat", "mrozone", "piekarnia",
    "artykuly-spozywcze", "dania-gotowe",
})

# Phase-1 pilot list — last-resort fallback if BOTH dynamic discovery
# sources (sitemap, homepage nav) fail outright (e.g. site unreachable in
# a way that returns empty/malformed responses rather than raising).
FALLBACK_CATEGORY_URLS = [
    f"{BASE}/nabial/mleko/",
    f"{BASE}/nabial/jogurty-naturalne/",
    f"{BASE}/nabial/sery/sery-zolte/",
    f"{BASE}/nabial/maslo/",
    f"{BASE}/pieczywo/",
    f"{BASE}/napoje/wody/",
    f"{BASE}/drogeria/papier-toaletowy-i-chusteczki/papier-toaletowy/",
]

MAX_PAGES = 1000             # hard cap: total category-listing page fetches per run.
                             # 500 -> 1000 (2026-07-23): the sitemap now yields ~245
                             # categories and the 500 cap was being hit mid-crawl on prod
                             # (2026-07-21 run: cap reached at 1,003/1,501 products, so
                             # roughly a third of the catalog silently never refreshed).
                             # ~245 categories x mostly 1-3 pages fits comfortably under
                             # 1000 while still guarding against a crawler trap.
MAX_PAGES_PER_CATEGORY = 20  # hard cap: pages within a single category (crawler-trap guard)
MAX_SITEMAPS = 10            # hard cap: child <sitemap> entries followed from the index

_TILE_SPLIT_RE = re.compile(r'<div class="product-tile js-product-tile')
_GTM_RE = re.compile(r'data-product-gtm="([^"]+)"')
_IMAGE_RE = re.compile(r'<meta itemprop="image" content="([^"]+)"')
_ITEMID_RE = re.compile(r'data-itemid="([^"]+)"')
_LOC_RE = re.compile(r'<loc>([^<]+)</loc>')
_HAS_NEXT_RE = re.compile(r'data-has-next="(true|false)"')
_TOTAL_ITEMS_RE = re.compile(r'refinements__total-items"[^>]*>\s*(\d+)')
_NAV_HREF_RE = re.compile(r'href="(/[a-z0-9\-]+(?:/[a-z0-9\-]+)*/)"')


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

    # ---- pure, fixture-testable category-discovery / pagination helpers ----

    @staticmethod
    def _extract_sitemap_locs(xml_text: str) -> List[str]:
        """Pure: pull every <loc>URL</loc> out of a sitemap or
        sitemap-index XML document."""
        return _LOC_RE.findall(xml_text)

    @staticmethod
    def _filter_category_urls(urls: List[str]) -> List[str]:
        """Pure: keep only genuine category-tree URLs out of a mixed list
        (sitemap <loc> entries, or homepage nav hrefs already resolved to
        absolute URLs).

        A URL qualifies if it (a) isn't a product detail page (those all
        end in `.html`, per sitemap recon — real category pages never do)
        and (b) its first path segment is one of the known department
        roots (DEPARTMENT_PREFIXES) — this excludes the promo/
        merchandising bucket pages that share the same sitemap/nav but
        aren't real categories (see module docstring).
        """
        out = []
        for u in urls:
            if not u.startswith(BASE):
                continue
            if u.endswith(".html"):
                continue
            path = u[len(BASE):].strip("/")
            if not path:
                continue
            seg0 = path.split("/")[0]
            if seg0 in DEPARTMENT_PREFIXES:
                out.append(u if u.endswith("/") else u + "/")
        return sorted(set(out))

    @staticmethod
    def _reduce_to_leaves(urls: List[str]) -> List[str]:
        """Pure: drop any category URL that is a strict path-ancestor of
        another discovered category URL, keeping only leaf (deepest)
        categories to actually crawl — see module docstring for why
        leaves-only is sufficient for full-catalog coverage here."""
        urls = sorted(set(urls))
        leaves = []
        for u in urls:
            prefix = u if u.endswith("/") else u + "/"
            if not any(o != u and o.startswith(prefix) for o in urls):
                leaves.append(u)
        return leaves

    @staticmethod
    def _extract_nav_category_urls(html_text: str) -> List[str]:
        """Pure: pull category-shaped href paths out of homepage nav HTML
        (the discovery fallback if the sitemap is unreachable — see module
        docstring; only reaches ~2 levels deep, strictly worse than the
        sitemap)."""
        hrefs = _NAV_HREF_RE.findall(html_text)
        urls = [BASE + h for h in hrefs]
        return BiedronkaScraper._filter_category_urls(urls)

    @staticmethod
    def _extract_pagination_info(html_text: str) -> Tuple[bool, Optional[int]]:
        """Pure: read a category-listing page's own report of whether a
        further page exists (`data-has-next` on the product grid) and its
        total item count (`refinements__total-items`), if present. Missing
        markers -> (False, None) — treated as "no more pages" (the safe
        default: better to under-page a malformed response than loop
        forever on it)."""
        has_next_match = _HAS_NEXT_RE.search(html_text)
        has_next = has_next_match is not None and has_next_match.group(1) == "true"
        total_match = _TOTAL_ITEMS_RE.search(html_text)
        total_items = int(total_match.group(1)) if total_match else None
        return has_next, total_items

    def discover_category_urls(self, fetch) -> List[str]:
        """Live: dynamically discover the full leaf-category-listing URL
        set. `fetch(url) -> str | None` is injected (real requests-backed
        implementation lives in fetch_products() below) so this method has
        no direct network dependency and stays unit-testable with a stub.

        Tries, in order: (a) sitemap index -> child sitemap(s) -> filtered
        leaves, (b) homepage nav links -> filtered leaves, (c) the
        original Phase-1 hardcoded pilot list. Each stage's own fetch/
        parse failure is caught and logged so it falls through to the next
        stage rather than raising.
        """
        try:
            index_xml = fetch(f"{BASE}/sitemap_index.xml")
            if index_xml:
                child_sitemaps = [
                    loc for loc in self._extract_sitemap_locs(index_xml)
                    if loc.endswith(".xml")
                ][:MAX_SITEMAPS]
                all_locs: List[str] = []
                for sm_url in child_sitemaps:
                    xml = fetch(sm_url)
                    if xml:
                        all_locs.extend(self._extract_sitemap_locs(xml))
                cats = self._reduce_to_leaves(self._filter_category_urls(all_locs))
                if cats:
                    self.logger.info(f"discovered {len(cats)} categories via sitemap")
                    return cats
        except Exception as e:
            self.logger.warning(f"sitemap category discovery failed: {e}")

        try:
            home_html = fetch(f"{BASE}/")
            if home_html:
                cats = self._reduce_to_leaves(self._extract_nav_category_urls(home_html))
                if cats:
                    self.logger.warning(
                        f"sitemap discovery empty; falling back to homepage nav "
                        f"({len(cats)} categories, shallower than the sitemap)"
                    )
                    return cats
        except Exception as e:
            self.logger.warning(f"homepage nav category discovery failed: {e}")

        self.logger.warning(
            "dynamic category discovery failed entirely; falling back to the "
            f"{len(FALLBACK_CATEGORY_URLS)}-URL Phase-1 pilot list"
        )
        return list(FALLBACK_CATEGORY_URLS)

    def fetch_products(self, category_urls: Optional[List[str]] = None) -> List[Product]:
        """Live path: dynamically discover the full leaf-category set (or
        crawl a given override / test subset if `category_urls` is
        passed), then crawl each with pagination via plain `requests` (no
        Playwright/session needed — these pages are server-rendered and
        reachable directly, same as Auchan PL). Politely delays
        `self.delay_between_requests` seconds before every request after
        the first; isolates errors per category (and per page within a
        category) so one dead category can't abort the whole crawl;
        deduplicates by `sku` across the entire run (see module docstring)."""
        import requests

        headers = {
            "User-Agent": UA,
            "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        }
        state = {"first_request": True}

        def _get(url: str) -> Optional[str]:
            if not state["first_request"]:
                time.sleep(self.delay_between_requests)
            state["first_request"] = False
            resp = requests.get(url, headers=headers, timeout=20)
            resp.raise_for_status()
            # Server declares charset but decode explicitly for consistency
            # with zabka.py's hardening against servers that don't.
            return resp.content.decode("utf-8", errors="replace")

        if category_urls is None:
            category_urls = self.discover_category_urls(_get)

        seen_sku = set()
        products: List[Product] = []
        pages_fetched = 0

        for url in category_urls:
            if pages_fetched >= MAX_PAGES:
                self.logger.warning(
                    f"MAX_PAGES ({MAX_PAGES}) safety cap reached; stopping crawl early "
                    f"with {len(products)} products from {pages_fetched} pages"
                )
                break
            try:
                page = 1
                current_url = url
                category_pages = 0
                while True:
                    html_text = _get(current_url)
                    pages_fetched += 1
                    category_pages += 1

                    parsed = self.parse(html_text)
                    for prod in parsed:
                        if prod.sku in seen_sku:
                            continue
                        seen_sku.add(prod.sku)
                        products.append(prod)

                    has_next, _total_items = self._extract_pagination_info(html_text)
                    if (not has_next or not parsed
                            or category_pages >= MAX_PAGES_PER_CATEGORY
                            or pages_fetched >= MAX_PAGES):
                        break
                    page += 1
                    current_url = f"{url}?page={page}"
            except Exception as e:
                self.logger.warning(f"'{url}' fetch failed: {e}")
                continue

        return products

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        # Polish prices use a comma decimal and often a trailing "zł"
        # (e.g. "3,49 zł").
        return Decimal(
            str(price_str).replace("zł", "").replace(",", ".").strip()
        )
