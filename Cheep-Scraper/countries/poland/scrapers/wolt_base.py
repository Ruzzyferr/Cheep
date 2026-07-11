"""Generic Wolt consumer-API venue scraper (Poland pipeline).

Shared base class for any grocery chain whose real online catalog lives on
Wolt's quick-commerce / delivery platform as one or more dark-store /
storefront "venues", reachable through Wolt's plain-JSON
`consumer-api.wolt.com` with NO authentication (only a normal browser
`User-Agent` + `App-Language: pl` header). Recon (task 23,
`.superpowers/sdd/task-23-lidl-zabka-recon.md`) reverse-engineered this API
surface from Wolt's production web bundles after the older, widely-documented
`restaurant-api.wolt.com` generation was sunset (HTTP 410). Two PL chains ride
on it:

- **Żabka** (store 47) via its "Żabka Jush" dark-store venues — a single
  Warsaw venue exposed 2,128 SKUs across 138 leaf categories, 98.5% carrying
  a `barcode_gtin` (EAN). See `zabka.py`.
- **Carrefour** (store 40) via its full hypermarket venues (e.g. "Carrefour
  Jerozolimskie") — 35 top-level / 319 leaf categories, ~100% GTIN coverage on
  the grocery leaves sampled. This REPLACES the previous direct-site scraper,
  which was Cloudflare-WAF blocked (403). See `carrefour_pl.py`.

Endpoint model (verified live; `consumer-api.wolt.com` has no robots.txt — it
is an API host, not a crawlable site, so no crawl-permission question applies):

- Venue discovery near a coordinate: `POST {SEARCH_URL}` body
  `{"q": <term>, "target": "venues", "lat": <lat>, "lon": <lon>}` → nearby
  venues, each with a `link.target` (a venue **id**) — see
  `extract_venue_ids_from_search()`.
- Brand roll-up (every venue of a chain in a city): `GET
  {VENUE_LIST_BASE}/<brand>-all?lat=&lon=` → `sections[].items[].venue.slug` —
  see `extract_venue_slugs_from_list()`.
- id → slug + metadata: `GET {STATIC_BASE}/<id-or-slug>/static` → `slug`,
  `brand_slug`, `brand_name`, `active_menu`, address, hours.
- Category tree (one call, whole venue): `GET {ASSORTMENT_BASE}/<slug>/
  assortment` → a `categories` array; each category has `name`/`slug` and
  either a non-empty `subcategories` array (ITS subcategories are the real leaf
  nodes to crawl) or an empty one (the category itself is the leaf, e.g.
  "Strefa kibica"). The tree is two levels deep everywhere observed. See
  `flatten_leaf_categories()`.
- Items for one leaf category (paginated): `GET {ASSORTMENT_BASE}/<slug>/
  assortment/categories/slug/<leaf-slug>[?page_token=<token>]` → `{"category":
  {...}, "items": [...], "metadata": {"next_page_token": <str|null>}}`. When
  `next_page_token` is non-null it must be replayed as the `page_token` query
  param. See `parse_category_items()` / `extract_next_page_token()`.

Item schema (fields consumed, from live payloads): `id` (Wolt's own stable
item id — used as `sku` and the cross-category dedup key), `name`, `price`
(**integer PLN CENTS**), `barcode_gtin` (EAN/GTIN — present on the large
majority of items; `null`/empty on the rest, left `None` honestly, never
guessed), `unit_info` (a package-size string, e.g. "1 l"/"500 g" — but see the
quantity-parsing note below, it is NOT reliable for multipacks),
`original_price` (PLN cents, `null` when not discounted), `images[0].url`,
`restrictions` (e.g. `[{"type": "alcohol", "age_limit": 18}]`).

Quantity/unit parsing: `unit_info` looks like the obvious source, but a live
example proved it is NOT reliable for multipacks — a "Snickers 2x 75 g" item
reports `unit_info: "75 g"` (the SINGLE-bar size, not the 150 g pack total).
The shared `scrapers.units.parse_quantity_and_unit()` handles "N x SIZE"
correctly against the product NAME (same approach biedronka.py uses). So this
base parses quantity/unit from `name` FIRST, falling back to `unit_info` only
when the name yields the parser's no-size default `(1.0, "adet")` but
`unit_info` doesn't.

Brand: no separate structured brand field exists on Wolt items (unlike
Biedronka's GA4 `item_brand`) — `brand` is left `None` rather than guessed out
of the name (per task instructions: "do NOT guess").

One-store pricing scope: each venue is a single dark-store / storefront, not a
synthesized national catalog, so a crawl is a one-store price snapshot (same as
the other PL chains' single online storefronts). The pinned venue slug + probe
coordinate are constructor arguments so re-pinning to another city/venue is a
one-line change; if the pinned slug ever 404s (Wolt slugs are known to shift),
`fetch_products()` falls back to re-discovering a live venue via the brand
roll-up (`venue_list_url`) and then via search (`search_term`).

Hardening (matches biedronka.py/auchan_pl.py): `self.delay_between_requests`
sleep before every request after the first (1.3s — the pace recon verified
safe across ~150 requests with zero 429s); per-leaf-category fetch errors are
caught and logged so one dead/renamed category can't abort the whole crawl;
`MAX_CATEGORIES` / `MAX_PAGES_PER_CATEGORY` hard caps guard against a crawler
trap; products are deduplicated by Wolt's stable item `id` across the ENTIRE
crawl. Alcohol/other out-of-domain categories are NOT dropped here (that would
silently discard real, correctly-priced-and-barcoded data) — exclusion is done
downstream via `config.json`'s `category_deny_prefixes`, matched against this
scraper's `raw_category` ("<top-level name>/<leaf name>"), exactly like Auchan
PL / Lidl PL.

Pure, fixture-testable, NO-network methods:
- `parse_category_items(payload, raw_category=None) -> List[Product]`
- `extract_next_page_token(payload) -> Optional[str]`
- `flatten_leaf_categories(tree) -> List[Tuple[str, str]]`
- `extract_venue_slugs_from_list(payload) -> List[str]`
- `extract_venue_ids_from_search(payload) -> List[str]`

`fetch_products()` is the only method that touches `requests`; it is the live
entry point the config.json runner calls.
"""
import importlib.util
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

    This file lives at countries/poland/scrapers/wolt_base.py — a directory
    ALSO named `scrapers`. Test harnesses that put this country's directory
    ahead of the repo root on sys.path cause a plain `from scrapers.base_scraper
    import ...` to resolve `scrapers` to *this* local package instead of the
    repo-root one, raising ModuleNotFoundError. Loading by explicit file path
    sidesteps the name collision entirely; base_scraper.py/units.py have no
    further `scrapers.*` imports at module scope, so this is safe.
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

CONSUMER_API_BASE = "https://consumer-api.wolt.com"
ASSORTMENT_BASE = f"{CONSUMER_API_BASE}/consumer-api/consumer-assortment/v1/venues/slug"
VENUE_LIST_BASE = f"{CONSUMER_API_BASE}/v1/pages/venue-list"
STATIC_BASE = f"{CONSUMER_API_BASE}/order-xp/web/v1/pages/venue/slug"
SEARCH_URL = f"{CONSUMER_API_BASE}/v1/pages/search"

# Central-Warsaw probe coordinate (Plac Defilad / Warsaw center), the point
# recon used to discover both chains' venues via /v1/pages/search. Default for
# every venue's re-discovery fallback; override per-scraper if re-pinning to
# another city.
DEFAULT_WARSAW_LAT = 52.2297
DEFAULT_WARSAW_LON = 21.0122

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "App-Language": "pl"}

MAX_CATEGORIES = 400          # hard cap: leaf categories crawled per run (Carrefour venue ~319)
MAX_PAGES_PER_CATEGORY = 20   # hard cap: pages within one category (crawler-trap guard)


class WoltVenueScraper(BaseScraper):
    """Base scraper for a single Wolt venue. Subclasses set `STORE_NAME` and
    pass the pinned `venue_slug` (+ optional brand roll-up `venue_list_url` and
    `search_term` for the re-discovery fallback) to `__init__`."""

    #: Store label written onto every Product. Subclasses MUST override.
    STORE_NAME: Optional[str] = None

    def __init__(
        self,
        store_name: str,
        venue_slug: str,
        venue_list_url: Optional[str] = None,
        search_term: Optional[str] = None,
        lat: float = DEFAULT_WARSAW_LAT,
        lon: float = DEFAULT_WARSAW_LON,
    ):
        super().__init__(store_name=store_name)
        self.venue_slug = venue_slug
        self.venue_list_url = venue_list_url
        self.search_term = search_term
        self.lat = lat
        self.lon = lon
        # Same host, low request count — 1.3s matches the pace recon verified
        # safe (zero 429s across ~150 requests). The BaseScraper 2s default
        # would work but is slower than necessary for a low-risk same-host crawl.
        self.delay_between_requests = 1.3

    # ---- pure, fixture-testable parsing (no network) ----------------------

    @classmethod
    def parse_category_items(cls, payload: dict, raw_category: Optional[str] = None) -> List[Product]:
        """Parse one `.../assortment/categories/slug/<leaf>` response envelope
        (`{"category": {...}, "items": [...], "metadata": {...}}`) into Products
        (store = `cls.STORE_NAME`).

        `raw_category` overrides the payload's own (leaf-only) category name —
        the live crawl passes the full "<top>/<leaf>" breadcrumb computed by
        `flatten_leaf_categories()` so config.json's `category_deny_prefixes`
        can match on it; a fixture/test calling this directly with no override
        falls back to `payload["category"]["name"]` (leaf name only).

        Per item: name/price (`price` = integer PLN CENTS → Decimal zł,
        skipped if missing or <= 0); barcode (`barcode_gtin` verbatim when
        present and non-empty, else `None` — never guessed); quantity/unit
        (parsed from `name` first, `unit_info` only as a fallback — see module
        docstring); original_price (`original_price` PLN cents, only when > the
        current price); image (`images[0].url`); sku (Wolt's stable `id`, used
        for cross-category/page dedup — items with no `id` are skipped);
        brand always `None` (no structured brand field on this feed).
        """
        products: List[Product] = []
        if not isinstance(payload, dict):
            return products

        category_name = raw_category
        if category_name is None:
            cat = payload.get("category") or {}
            category_name = cat.get("name")

        items = payload.get("items") or []
        for item in items:
            if not isinstance(item, dict):
                continue

            item_id = item.get("id")
            if not item_id:
                continue

            name = item.get("name")
            if not name or not str(name).strip():
                continue

            price_cents = item.get("price")
            if price_cents is None:
                continue
            try:
                price = (Decimal(str(price_cents)) / Decimal(100)).quantize(Decimal("0.01"))
            except Exception:
                continue
            if price <= 0:
                continue

            barcode_raw = item.get("barcode_gtin")
            barcode = str(barcode_raw).strip() if barcode_raw else None
            barcode = barcode or None

            unit_info = item.get("unit_info")
            qty, unit = parse_quantity_and_unit(str(name))
            if (qty, unit) == (1.0, "adet") and unit_info:
                qty2, unit2 = parse_quantity_and_unit(str(unit_info))
                if (qty2, unit2) != (1.0, "adet"):
                    qty, unit = qty2, unit2

            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

            original_price = None
            orig_cents = item.get("original_price")
            if orig_cents is not None:
                try:
                    op = (Decimal(str(orig_cents)) / Decimal(100)).quantize(Decimal("0.01"))
                    if op > price:
                        original_price = op
                except Exception:
                    original_price = None

            images = item.get("images") or []
            image_url = None
            if images and isinstance(images[0], dict):
                image_url = images[0].get("url")

            products.append(Product(
                name=str(name).strip(),
                price=price,
                store=cls.STORE_NAME,
                brand=None,
                barcode=barcode,
                sku=str(item_id),
                raw_category=category_name,
                unit=unit,
                quantity=qty,
                unit_price=unit_price,
                unit_price_unit=unit_price_unit,
                original_price=original_price,
                image_url=image_url,
                product_url=None,
                country_code="PL",
            ))
        return products

    @staticmethod
    def extract_next_page_token(payload: dict) -> Optional[str]:
        """Pure: read the pagination cursor (`metadata.next_page_token`) out of
        a category-items response. Missing/malformed -> None (treated as "no
        more pages" — the safe default)."""
        if not isinstance(payload, dict):
            return None
        return (payload.get("metadata") or {}).get("next_page_token")

    @staticmethod
    def flatten_leaf_categories(tree: dict) -> List[Tuple[str, str]]:
        """Pure: flatten the two-level `.../assortment` category tree into
        `(leaf_slug, raw_category)` pairs, where `raw_category` is
        "<top-level name>/<leaf name>" for a category with subcategories, or
        just the top-level name when it has none (it IS the leaf — see module
        docstring, e.g. "Strefa kibica"). Categories/subcategories with no
        `slug` are skipped (defensive; not observed live)."""
        out: List[Tuple[str, str]] = []
        if not isinstance(tree, dict):
            return out
        for cat in tree.get("categories") or []:
            if not isinstance(cat, dict):
                continue
            name = cat.get("name")
            slug = cat.get("slug")
            subs = cat.get("subcategories") or []
            if subs:
                for sub in subs:
                    if not isinstance(sub, dict):
                        continue
                    sub_slug = sub.get("slug")
                    sub_name = sub.get("name")
                    if not sub_slug:
                        continue
                    raw_cat = f"{name}/{sub_name}" if name else sub_name
                    out.append((sub_slug, raw_cat))
            elif slug:
                out.append((slug, name))
        return out

    @staticmethod
    def extract_venue_slugs_from_list(payload: dict) -> List[str]:
        """Pure: pull candidate venue slugs out of a
        `{VENUE_LIST_BASE}/<brand>-all` roll-up response
        (`sections[].items[].venue.slug`) — the brand-wide re-discovery path if
        the pinned venue slug ever 404s."""
        slugs: List[str] = []
        if not isinstance(payload, dict):
            return slugs
        for section in payload.get("sections") or []:
            if not isinstance(section, dict):
                continue
            for item in section.get("items") or []:
                if not isinstance(item, dict):
                    continue
                venue = item.get("venue") or {}
                slug = venue.get("slug")
                if slug:
                    slugs.append(slug)
        return slugs

    @staticmethod
    def extract_venue_ids_from_search(payload: dict) -> List[str]:
        """Pure: pull candidate venue **ids** out of a `POST {SEARCH_URL}`
        response — every `link` with `type == "venue-id"` carries the venue id
        in `link.target` (resolvable to a slug via the `/static` endpoint). Used
        as the last-resort re-discovery path when both the pinned slug and the
        brand roll-up fail."""
        ids: List[str] = []
        if not isinstance(payload, dict):
            return ids

        def _walk(node):
            if isinstance(node, dict):
                link = node.get("link")
                if isinstance(link, dict) and link.get("type") == "venue-id" and link.get("target"):
                    ids.append(link["target"])
                for value in node.values():
                    _walk(value)
            elif isinstance(node, list):
                for value in node:
                    _walk(value)

        _walk(payload)
        # de-dup preserving order
        seen = set()
        return [x for x in ids if not (x in seen or seen.add(x))]

    # ---- live path (requests) ---------------------------------------------

    def _resolve_slug_from_id(self, get_fn, venue_id: str) -> Optional[str]:
        """Live: resolve a venue id to its slug via the `/static` page."""
        static = get_fn(f"{STATIC_BASE}/{venue_id}/static")
        found = {}

        def _walk(node):
            if isinstance(node, dict):
                if "slug" in node and isinstance(node["slug"], str) and "slug" not in found:
                    found["slug"] = node["slug"]
                for value in node.values():
                    _walk(value)
            elif isinstance(node, list):
                for value in node:
                    _walk(value)

        _walk(static)
        return found.get("slug")

    def fetch_products(self, venue_slug: Optional[str] = None) -> List[Product]:
        """Live path: fetch the pinned venue's category tree, flatten it to
        leaf categories, then crawl each leaf (with `page_token` pagination) via
        plain `requests` — no Playwright/session needed, this is an
        unauthenticated public JSON API. Politely delays
        `self.delay_between_requests` before every request after the first;
        isolates errors per leaf category; deduplicates by Wolt's stable item
        `id` across the entire run; falls back to re-discovering a live venue
        slug (brand roll-up, then search) if the pinned one 404s/errors."""
        import requests

        venue_slug = venue_slug or self.venue_slug
        state = {"first_request": True}

        def _get(url: str, params: Optional[dict] = None) -> dict:
            if not state["first_request"]:
                time.sleep(self.delay_between_requests)
            state["first_request"] = False
            resp = requests.get(url, headers=HEADERS, params=params, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()

        tree = None
        try:
            tree = _get(f"{ASSORTMENT_BASE}/{venue_slug}/assortment")
        except Exception as e:
            self.logger.warning(
                f"assortment tree fetch failed for venue '{venue_slug}': {e}; "
                "trying venue re-discovery"
            )
            for candidate in self._rediscover_venue_slugs(_get):
                try:
                    tree = _get(f"{ASSORTMENT_BASE}/{candidate}/assortment")
                    venue_slug = candidate
                    self.logger.info(f"re-discovered live venue slug '{candidate}'")
                    break
                except Exception:
                    continue

        if not tree:
            self.logger.error("could not fetch a category tree for any venue; aborting crawl")
            return []

        leaf_categories = self.flatten_leaf_categories(tree)[:MAX_CATEGORIES]
        self.logger.info(f"crawling {len(leaf_categories)} leaf categories on venue '{venue_slug}'")

        seen_sku = set()
        products: List[Product] = []

        for leaf_slug, raw_category in leaf_categories:
            try:
                page_token = None
                pages = 0
                while True:
                    params = {"page_token": page_token} if page_token else None
                    payload = _get(
                        f"{ASSORTMENT_BASE}/{venue_slug}/assortment/categories/slug/{leaf_slug}",
                        params=params,
                    )
                    pages += 1

                    for prod in self.parse_category_items(payload, raw_category=raw_category):
                        if prod.sku in seen_sku:
                            continue
                        seen_sku.add(prod.sku)
                        products.append(prod)

                    page_token = self.extract_next_page_token(payload)
                    if not page_token or pages >= MAX_PAGES_PER_CATEGORY:
                        break
            except Exception as e:
                self.logger.warning(f"category '{raw_category}' ({leaf_slug}) fetch failed: {e}")
                continue

        return products

    def _rediscover_venue_slugs(self, get_fn) -> List[str]:
        """Live: yield candidate venue slugs from the brand roll-up
        (`venue_list_url`), then — if that yields nothing — from a venue search
        (`search_term`), resolving each returned id to a slug. Any failure is
        swallowed so the caller can fall through to the next source.

        The search step is skipped when the brand roll-up call itself RAISED (as
        opposed to returning an empty list): a raising roll-up means the whole
        `consumer-api.wolt.com` host is unreachable, so a search POST to the
        same host would only fail too (and needlessly touch the network)."""
        candidates: List[str] = []
        roll_up_reachable = False
        if self.venue_list_url:
            try:
                venue_list = get_fn(self.venue_list_url, params={"lat": self.lat, "lon": self.lon})
                roll_up_reachable = True
                candidates.extend(self.extract_venue_slugs_from_list(venue_list))
            except Exception as e:
                self.logger.warning(f"brand roll-up re-discovery failed: {e}")

        search_allowed = roll_up_reachable or not self.venue_list_url
        if not candidates and self.search_term and search_allowed:
            try:
                import requests
                time.sleep(self.delay_between_requests)
                resp = requests.post(
                    SEARCH_URL,
                    json={"q": self.search_term, "target": "venues", "lat": self.lat, "lon": self.lon},
                    headers=HEADERS,
                    timeout=self.timeout,
                )
                resp.raise_for_status()
                for venue_id in self.extract_venue_ids_from_search(resp.json()):
                    slug = self._resolve_slug_from_id(get_fn, venue_id)
                    if slug:
                        candidates.append(slug)
            except Exception as e:
                self.logger.warning(f"search re-discovery failed: {e}")
        return candidates

    def fetch_product_detail(self, product_url: str) -> dict:
        return {}

    def parse_price(self, price_str: str) -> Decimal:
        # Not used by this scraper (price arrives as integer PLN cents in the
        # JSON payload, converted directly in parse_category_items) — kept for
        # BaseScraper's abstract-method contract and parity with the other PL
        # scrapers' Polish comma-decimal handling.
        return Decimal(str(price_str).replace("zł", "").replace(",", ".").strip())
