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

Phase 2 (2026-07-11): expanded fetch_products() from the Phase-1 pilot's 32
hardcoded search terms (~59 products, page-1-only) to a much broader,
paginated crawl. Recon for this expansion:

- `GET /robots.txt` -> `Sitemap: https://www.lidl.pl/static/sitemap.xml`,
  a sitemap INDEX listing (among others)
  `https://www.lidl.pl/p/export/PL/pl/product_sitemap.xml.gz` — a gzipped
  sitemap of **13,425** distinct product-detail (`/p/<slug>/p<id>`) URLs,
  the full historical catalog. However, fetching a PDP for a product NOT
  currently part of the live weekly assortment (e.g. a bread that isn't
  this week's leaflet item) returns a payload whose `price` object has
  *only* currency-metadata keys (`currencyCode`/`currencySymbol`/...) with
  no `price`/`oldPrice`/`packaging` fields at all — i.e. genuinely no price
  to scrape, confirming the module's original finding that Lidl PL is a
  weekly-leaflet business, not an always-on online store: the sitemap's
  13,425 URLs are the full SKU *history*, but only whatever is on this
  week's assortment carries a scrapable price (confirmed conversely: a
  search-result item's own PDP DOES carry live `price`/`oldPrice`/
  `packaging` when that item is currently active). Crawling all 13,425 PDPs
  politely (2s/request) would take several hours for mostly-empty results,
  so this route was not pursued further.
- `robots.txt` also disallows `*search?q=*` and `*?offset=*` — the search
  endpoints this scraper (both before and after this change) rely on, since
  Lidl PL's own site search is the only reachable source of real current
  prices (see the top of this docstring). This was already the case for
  the Phase-1 `/q/search?q=<term>` endpoint prior to this change; offset
  pagination on the same already-relied-upon endpoint family does not add a
  new category of robots.txt exception, just uses it more fully.
- The search RESULT page's own facet sidebar links to a clean, un-nested
  JSON API — `GET /q/api/search?assortment=PL&locale=pl_PL&version=v2.0.0&q=<term>`
  (`Accept: */*`; an explicit `Accept: application/json` gets HTTP 406 — the
  real content-type is the custom `application/mindshift.search+json`) —
  returning flat JSON (`{"numFound", "offset", "fetchsize", "items": [...],
  "facets": [...], ...}`, no devalue-array indirection to resolve at all.
  This is what `parse_api_search()`/`fetch_products()` below are now built
  against (`fixtures/lidl_pl_api_sample.json`, a live capture trimmed to a
  representative handful of `q=mleko` items). The OLDER `parse()` above is
  untouched and stays fixture-tested against the original HTML
  `__NUXT_DATA__` payload shape for backward compatibility, but is no
  longer what the live crawl uses.
  - **Pagination**: `offset`/`fetchsize`/`numFound` are plain top-level
    integers in the response (confirmed live: `q=mleko` -> `numFound=59`,
    `fetchsize=36`; a second request with `&offset=36` returns the
    remaining 23, non-overlapping with page 1). `_extract_search_meta()`
    reads these three fields; the crawl loop advances `offset` by the
    response's own `fetchsize` until `offset+fetchsize >= numFound`,
    capped by `MAX_PAGES_PER_TERM` and a global `MAX_PAGES` against a
    hypothetical pathological `numFound`.
  - **Category browsing**: the same endpoint accepts `category=<name>`
    INSTEAD of `q=<term>` (found via a facet link,
    `.../q/api/search?...&q=mleko&category=Żywność+i+napoje`, then
    confirmed it also works with no `q` at all) and returns that
    top-level department's items directly — effectively a category-listing
    crawl through the same API, closer to Biedronka's category-tree
    approach than pure keyword search. Inspecting the `category` facet
    across several different keyword queries surfaced the same closed set
    of 7 top-level "needs world" categories every time
    (`CATEGORY_TERMS` below: Żywność i napoje, Kuchnia i gospodarstwo
    domowe, Warsztat i ogród, Sport i wypoczynek, Dom i wyposażenie wnętrz,
    Moda i akcesoria, Niemowlę, dziecko i zabawki) — crawled the same way
    (paginated via `offset`/`fetchsize`/`numFound`) as a broad supplement
    to the keyword-term crawl, not a replacement for it (each keyword
    search's `numFound` also includes semantically-related, not just
    literal-substring, matches — e.g. `q=mleko` surfaces milk frothers and
    coffee machines alongside actual milk — so keyword terms and category
    browsing each reach products the other doesn't).
  - **Richer category**: each item's flat `category` field is "Food" or
    "NonFood" for groceries (same as the old HTML payload) but a full,
    specific breadcrumb string for general-merchandise items (e.g.
    `"Kategorie/Dom & Kuchnia/Małe AGD & Kuchnia/Kawa & więcej/Akcesoria do
    kawy/Spieniacze do mleka"`). For the "Food"/"NonFood"-only case, the
    item's own `keyfacts.wonCategoryPrimary` carries an equally specific
    breadcrumb from a *different* (needs-based, "Światy potrzeb") taxonomy
    (e.g. `"Światy potrzeb/Żywność i żywność w pobliżu/Owoce i
    warzywa/Owoce"` for a melon) — `parse_api_search()` prefers the flat
    `category` field when it's already specific, and falls back to
    `keyfacts.wonCategoryPrimary` only when `category` is the generic
    "Food"/"NonFood" placeholder. Both are a large improvement over the
    original 2-value category set.
  - **EAN, revisited**: this recon re-examined the original docstring's
    claim of a `gs1`/`ean` field on NonFood items. The API payload's
    `gs1Attributes` list is NOT a barcode — every populated instance
    observed was a non-GTIN product-attribute record (e.g.
    `{"keyLabel": "Target Use/Application", ...}`); the PDP payload's
    separate `eans` field was also empty (`[]`) on every product checked,
    Food and NonFood alike. `barcode` therefore stays `None` for every
    product, honestly, superseding the earlier (unconfirmed-in-practice)
    claim — this scraper still surfaces no barcode field for anything.
  - **Packaging text quirk**: `price.packaging.text` now sometimes embeds
    a trailing pre-promo-reference clause after the real package size,
    e.g. `"1 kg * cena przed obniżką: 1 kg = 8,99"` or
    `"250 g różne rodzaje 100 g = 4,20"` (the trailing `"<unit> = <price>"`
    is a *per-reference-unit* price, not a second package size). The
    shared `parse_quantity_and_unit()` picks the LAST size-shaped token in
    a string, which would silently pick up that trailing reference instead
    of the real leading package size for the second example (`100 g`
    instead of the true `250 g`) — `_clean_packaging_text()` strips the
    trailing `"[* ][cena przed obniżką: ]<num><unit> = <num>"` clause
    before handing the text to the shared parser, so the real quantity
    survives.
- Per-term/category fetch errors are isolated (caught, logged, the crawl
  moves on) — same principle as Biedronka's per-category isolation.
  Deduplication is by `sku` (erpNumber, falling back to itemId/productId)
  across the *entire* crawl (keyword terms AND category browsing share one
  `seen_sku` set) — first occurrence wins; terms/categories are crawled in
  list order (keyword terms first, then the 7 category-browse terms), so
  this is deterministic run-to-run.
"""
import importlib.util
import json
import re
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

# Curated search terms — broad coverage across canonical grocery categories
# PLUS a modest general-merchandise vocabulary (Lidl PL's search results mix
# both — see module docstring's Phase 2 recon), fed to the JSON search API
# (mirrors Migros CH's search-driven approach; Lidl PL's own site search is
# the only reachable source of real current prices, see module docstring).
SEARCH_TERMS = [
    # dairy / eggs
    "mleko", "ser", "jogurt", "jajka", "maslo", "smietana", "maslanka",
    "kefir", "twarog", "serek",
    # meat / fish
    "kurczak", "wolowina", "wieprzowina", "wedlina", "szynka", "kielbasa",
    "ryba", "losos", "tunczyk", "parowki", "kabanosy",
    # fruit / veg
    "pomidory", "ogorki", "ziemniaki", "cebula", "marchew", "papryka",
    "salata", "jablka", "banany", "gruszki", "cytryny", "winogrona",
    "truskawki", "cebula", "czosnek", "grzyby",
    # pantry / dry goods
    "ryz", "makaron", "maka", "cukier", "sol", "olej", "oliwa", "kasza",
    "platki sniadaniowe", "muesli", "orzechy", "bakalie", "miod", "dzem",
    "keczup", "majonez", "musztarda", "przyprawy", "ocet", "hummus",
    "tortilla", "sos",
    # drinks
    "woda", "sok", "kawa", "herbata", "wino", "piwo", "napoje energetyczne",
    # snacks / sweets
    "czekolada", "ciastka", "chipsy", "wafle", "cukierki", "guma do zucia",
    "herbatniki", "lody", "popcorn",
    # bakery
    "chleb", "bulka", "bagietka", "pieczywo",
    # frozen / prepared
    "mrozonki", "pierogi", "pizza", "zupa", "bulion", "dania gotowe",
    "konserwy",
    # household / cleaning
    "srodki czystosci", "proszek do prania", "plyn do naczyn",
    "papier toaletowy", "chusteczki", "worki na smieci",
    # baby / personal care
    "pieluchy", "kosmetyki", "szampon", "mydlo", "pasta do zebow",
    "dezodorant", "krem",
    # general merchandise
    "zabawki", "narzedzia", "wiertarka", "ogrod", "meble", "posciel",
    "koc", "recznik", "oswietlenie", "elektronika", "sluchawki",
    "ladowarka", "rower", "sport", "odziez", "buty", "walizka",
]

# Lidl PL's own facets consistently surface this closed set of 7 top-level
# "Światy potrzeb" (needs-world) departments (see module docstring); each is
# crawled via `category=<name>` (no `q`) as a broad supplement to the
# keyword-term crawl above, since it reaches items keyword search doesn't
# (and vice versa).
CATEGORY_TERMS = [
    "Żywność i napoje",
    "Kuchnia i gospodarstwo domowe",
    "Warsztat i ogród",
    "Sport i wypoczynek",
    "Dom i wyposażenie wnętrz",
    "Moda i akcesoria",
    "Niemowlę, dziecko i zabawki",
]

# The JSON search API (see module docstring's Phase 2 recon) — cleaner and
# more capable than the HTML page's embedded __NUXT_DATA__ (used by the
# older parse() above): flat JSON, offset/fetchsize/numFound pagination
# fields, and a category=<name> browsing mode.
API_URL = f"{BASE}/q/api/search"
API_STATIC_PARAMS = {"assortment": "PL", "locale": "pl_PL", "version": "v2.0.0"}

MAX_PAGES = 1000            # hard cap: total API page fetches per run
MAX_PAGES_PER_TERM = 15     # hard cap: pages within a single term/category (crawler-trap guard)

# Strips a trailing pre-promo reference clause off `price.packaging.text`
# (e.g. "1 kg * cena przed obniżką: 1 kg = 8,99" -> "1 kg"; "250 g różne
# rodzaje 100 g = 4,20" -> "250 g różne rodzaje") — see module docstring's
# "Packaging text quirk" note. Without this, the shared quantity parser (which
# picks the LAST size-shaped token) can silently pick up the reference
# per-unit clause instead of the real leading package size.
# `$` ANKRAJI KALDIRILDI ve para birimi/parantez kuyruğu tolere ediliyor.
#
# Referans cümlesi YALNIZCA dizenin en sonundaysa siliniyordu. Gerçek Lidl
# verisinde cümlenin ardından "zl" gelebiliyor ya da tamamı parantez içinde
# olabiliyor; o hâllerde silinmiyordu ve paylaşılan miktar ayrıştırıcısı
# (SON boyut-benzeri belirteci seçer) gerçek paket boyutu yerine REFERANS
# birimini alıyordu:
#     "400 g 1 kg = 18,73 zl"   -> (1.0, kg)      YANLIŞ, olması gereken (400, g)
#     "500 g (1 kg = 43,98)"    -> (1.0, kg)      YANLIŞ
# Miktar tam olarak 1.0 çıktığı için `foreign_import`ın "1 değilse szt'ye
# düşür" koruması da devreye girmiyordu. Sonuç: PAKET FİYATI, KİLO FİYATI
# olarak yayınlanıyordu — üretim çıktısında doğrulandı (PILOS Ser gouda XXL,
# price 7.49, unit "kg", quantity 1.0). Lidl bu yüzden olduğundan çok daha
# ucuz görünüyordu; bir fiyat karşılaştırma uygulamasında bu, doğrudan yanlış
# tavsiye demek.
_PACKAGING_REF_SUFFIX_RE = re.compile(
    r"\s*[(\[]?\s*\*?\s*(?:cena przed obniżk\w*\s*:\s*)?"
    r"[\d.,]+\s*[a-ząćęłńóśźż]+\s*=\s*[\d.,]+\s*"
    r"(?:z[lł])?\s*[)\]]?\s*$",
    re.IGNORECASE,
)


def _clean_packaging_text(text: Optional[str]) -> Optional[str]:
    """Pure: strip a trailing pre-promo-reference clause off a packaging
    text string (see `_PACKAGING_REF_SUFFIX_RE` above); returns None for
    falsy/whitespace-only input."""
    if not text:
        return None
    cleaned = _PACKAGING_REF_SUFFIX_RE.sub("", text).strip()
    return cleaned or None


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

    @staticmethod
    def parse_api_search(raw_text: str) -> List[Product]:
        """Parse a saved `/q/api/search` JSON response (see module
        docstring's Phase 2 recon) into Products — this is what the live
        crawl now uses (the older `parse()` above stays as-is, still
        fixture-tested, for the original HTML-embedded payload shape).

        Flat JSON, no devalue indirection: `data["items"]` is a list of
        `{"resultClass": "product", "gridbox": {"data": {...}}, ...}`
        wrappers (non-product `resultClass` values, if any ever appear,
        are skipped defensively). For each product's `gridbox.data`:
        - name: `fullTitle`, falling back to `title`.
        - brand: `brand.name` (many grocery items have no `name` key at
          all — `showBrand: false` with nothing else — handled via `.get`).
        - price: `price.price`; `price.oldPrice` is the pre-promo
          reference when positive and different from `price` (a `0`/falsy
          `oldPrice` means "not discounted", same sentinel as `parse()`).
        - quantity/unit: `price.packaging.text`, cleaned of its trailing
          reference-price clause via `_clean_packaging_text()` (see module
          docstring) before the shared quantity/unit parser.
        - raw_category: the flat `category` field when it's a specific
          breadcrumb (general merchandise); falls back to
          `keyfacts.wonCategoryPrimary` (a different, also-specific
          breadcrumb) when `category` is just the generic "Food"/"NonFood"
          placeholder; falls back to the raw `category` value itself if
          neither is usable.
        - image: `image` (already an absolute URL).
        - product_url: `canonicalPath` resolved against `BASE`.
        - sku: `erpNumber`, falling back to `itemId`/`productId`.
        - barcode: `None` for every product — see module docstring's
          "EAN, revisited" note (no genuine GTIN field found anywhere in
          this payload).

        Items with no positive current price, or an empty/whitespace name,
        are skipped; duplicate sku within the same response is deduped
        (first occurrence wins).
        """
        try:
            data = json.loads(raw_text)
        except (ValueError, TypeError):
            return []
        items = data.get("items") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return []

        products: List[Product] = []
        seen_sku = set()
        for wrapper in items:
            if not isinstance(wrapper, dict) or wrapper.get("resultClass") != "product":
                continue
            item = wrapper.get("gridbox")
            item = item.get("data") if isinstance(item, dict) else None
            if not isinstance(item, dict):
                continue

            price_obj = item.get("price")
            if not isinstance(price_obj, dict):
                continue
            price_val = price_obj.get("price")
            if price_val in (None, ""):
                continue
            try:
                price = Decimal(str(price_val))
            except Exception:
                continue
            if price <= 0:
                continue

            name = item.get("fullTitle") or item.get("title")
            if not name or not str(name).strip():
                continue

            old_price_val = price_obj.get("oldPrice")
            original = None
            if old_price_val not in (None, ""):
                try:
                    old_price = Decimal(str(old_price_val))
                    if old_price > 0 and old_price != price:
                        original = old_price
                except Exception:
                    original = None

            brand_obj = item.get("brand")
            brand = None
            if isinstance(brand_obj, dict):
                b = brand_obj.get("name")
                brand = b if isinstance(b, str) and b.strip() else None

            packaging_obj = price_obj.get("packaging")
            packaging_text = packaging_obj.get("text") if isinstance(packaging_obj, dict) else None
            cleaned_packaging = _clean_packaging_text(packaging_text if isinstance(packaging_text, str) else None)
            qty, unit = parse_quantity_and_unit(cleaned_packaging)
            unit_price, unit_price_unit = compute_unit_price(price, qty, unit)

            category = item.get("category")
            raw_category = None
            if isinstance(category, str) and category and category not in ("Food", "NonFood"):
                raw_category = category
            else:
                keyfacts = item.get("keyfacts")
                won_cat = keyfacts.get("wonCategoryPrimary") if isinstance(keyfacts, dict) else None
                if isinstance(won_cat, str) and won_cat.strip():
                    raw_category = won_cat
                elif isinstance(category, str) and category:
                    raw_category = category

            image = item.get("image")
            image_url = image if isinstance(image, str) and image.startswith("http") else None

            canonical_path = item.get("canonicalPath")
            product_url = f"{BASE}{canonical_path}" if isinstance(canonical_path, str) and canonical_path else None

            sku_raw = item.get("erpNumber") or item.get("itemId") or item.get("productId")
            sku = str(sku_raw or name)[:64]
            if sku in seen_sku:
                continue
            seen_sku.add(sku)

            products.append(Product(
                name=str(name).strip(),
                price=price,
                store="Lidl",
                brand=brand,
                barcode=None,
                sku=sku,
                raw_category=raw_category,
                unit=unit,
                quantity=qty,
                unit_price=unit_price,
                unit_price_unit=unit_price_unit,
                original_price=original,
                image_url=image_url,
                product_url=product_url,
                country_code="PL",
            ))
        return products

    @staticmethod
    def _extract_search_meta(raw_text: str) -> Tuple[int, int, int]:
        """Pure: read `(offset, fetchsize, numFound)` from a `/q/api/search`
        JSON response — drives the offset-pagination loop in
        `fetch_products()`. Malformed/missing values default to `(0, 0, 0)`
        — "no results, stop" is the safe default (better to under-page a
        malformed response than loop forever on it)."""
        try:
            data = json.loads(raw_text)
        except (ValueError, TypeError):
            return (0, 0, 0)
        if not isinstance(data, dict):
            return (0, 0, 0)
        offset = data.get("offset")
        fetchsize = data.get("fetchsize")
        num_found = data.get("numFound")
        offset = offset if isinstance(offset, int) else 0
        fetchsize = fetchsize if isinstance(fetchsize, int) and fetchsize > 0 else 0
        num_found = num_found if isinstance(num_found, int) else 0
        return (offset, fetchsize, num_found)

    def fetch_products(
        self,
        terms: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
    ) -> List[Product]:
        """Live path: plain `requests` GET of the JSON search API
        (`API_URL`, see module docstring) for each keyword term (`q=`) and
        each top-level category (`category=`), paginating via
        `offset`/`fetchsize`/`numFound` (see `_extract_search_meta`).
        Politely delays `self.delay_between_requests` seconds before every
        request after the first; isolates errors per term/category (and
        per page within one) so a single dead term can't abort the whole
        crawl; deduplicates by `sku` across the entire run (keyword terms
        AND category browsing share one `seen_sku` set, first occurrence
        wins — see module docstring).

        `terms`/`categories` default to `SEARCH_TERMS`/`CATEGORY_TERMS`
        when not given (both `None`); passing `categories=[]` restricts the
        crawl to keyword search only (e.g. for a fast/small test run)."""
        import requests

        headers = {
            "User-Agent": UA,
            "Accept": "*/*",
            "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        }
        terms = SEARCH_TERMS if terms is None else terms
        categories = CATEGORY_TERMS if categories is None else categories
        seeds = [("q", t) for t in terms] + [("category", c) for c in categories]

        state = {"first_request": True}

        def _get(url: str) -> str:
            if not state["first_request"]:
                time.sleep(self.delay_between_requests)
            state["first_request"] = False
            resp = requests.get(url, headers=headers, timeout=20)
            resp.raise_for_status()
            # Decode .content explicitly (zabka.py-style hardening against a
            # server that omits/mis-declares its charset).
            return resp.content.decode("utf-8", errors="replace")

        seen_sku = set()
        products: List[Product] = []
        pages_fetched = 0

        for param_name, value in seeds:
            if pages_fetched >= MAX_PAGES:
                self.logger.warning(
                    f"MAX_PAGES ({MAX_PAGES}) safety cap reached; stopping crawl early "
                    f"with {len(products)} products from {pages_fetched} pages"
                )
                break
            try:
                offset = 0
                term_pages = 0
                while True:
                    params = dict(API_STATIC_PARAMS)
                    params[param_name] = value
                    if offset:
                        params["offset"] = offset
                    raw = _get(f"{API_URL}?{urlencode(params)}")
                    pages_fetched += 1
                    term_pages += 1

                    parsed = self.parse_api_search(raw)
                    for prod in parsed:
                        if prod.sku in seen_sku:
                            continue
                        seen_sku.add(prod.sku)
                        products.append(prod)

                    cur_offset, fetchsize, num_found = self._extract_search_meta(raw)
                    next_offset = cur_offset + fetchsize
                    if (fetchsize <= 0 or next_offset >= num_found or not parsed
                            or term_pages >= MAX_PAGES_PER_TERM
                            or pages_fetched >= MAX_PAGES):
                        break
                    offset = next_offset
            except Exception as e:
                self.logger.warning(f"'{param_name}={value}' fetch failed: {e}")
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
