"""Carrefour (Poland) scraper — Wolt hypermarket consumer API.

Thin subclass of the shared `WoltVenueScraper` (see `wolt_base.py` for the full
endpoint model, item schema, quantity-parsing caveat, and hardening notes).

REWRITE (2026-07-11, task 24). The previous direct-site scraper was Cloudflare
blocked: recon 2026-07-02 found `requests.get("https://www.carrefour.pl/")` = 403
with a Cloudflare WAF challenge page, reproduced under headless Playwright — no
product JSON reachable, so the old `fetch_products()` raised NotImplementedError.
Task-24 recon found Carrefour's real online catalog is fully reachable on Wolt:
Carrefour runs its hypermarkets as storefront venues on Wolt's unauthenticated,
plain-JSON `consumer-api.wolt.com` — no Cloudflare, no auth, no Playwright.

The pinned venue is **Carrefour Jerozolimskie** (a full central-Warsaw
hypermarket, NOT a small "Carrefour Express"-style dark store), slug
`carrefour-jerozolimskie`, discovered via `POST /v1/pages/search
{"q":"carrefour","target":"venues"}` from central Warsaw during recon. Its
assortment tree exposes 35 top-level / 319 leaf categories; the grocery leaves
sampled (dairy) returned ~100% `barcode_gtin` (EAN) coverage and full
`page_token` pagination — the same schema Żabka rides on. If the pinned slug
ever 404s, `fetch_products()` falls back to re-discovering a live Carrefour
venue via the brand roll-up `GET /v1/pages/venue-list/carrefour-all` (then a
`carrefour` venue search).

One-store pricing scope: this is a single Warsaw hypermarket venue's prices, not
a synthesized national catalog — the same one-store snapshot model as the other
PL chains (`VENUE_SLUG` / `VENUE_LIST_URL` are module constants for easy
re-pinning). No `category_deny_prefixes`-style domain filtering is applied here;
add it in config.json if the non-grocery departments (Moda/clothing, Artykuły
domowe/homeware, Artykuły biurowe/office) should be excluded from ingest, the
same mechanism Auchan PL uses.

Class name (`CarrefourPLScraper`) and `fetch_products()` signature are unchanged
so the config.json runner keeps working.
"""
import importlib.util
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent


def _load_sibling_module(name: str):
    """Load a sibling scraper module (wolt_base.py) by absolute file path — see
    zabka.py's identical helper for why (this file is loaded via
    spec_from_file_location, so `import wolt_base` can't be relied on)."""
    key = f"_cheep_pl_scraper_{name}"
    if key in sys.modules:
        return sys.modules[key]
    spec = importlib.util.spec_from_file_location(key, _HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[key] = mod
    spec.loader.exec_module(mod)
    return mod


_wolt_base = _load_sibling_module("wolt_base")
WoltVenueScraper = _wolt_base.WoltVenueScraper
# Re-exported for parity with zabka.py (module-scope access to the endpoint bases).
ASSORTMENT_BASE = _wolt_base.ASSORTMENT_BASE
CONSUMER_API_BASE = _wolt_base.CONSUMER_API_BASE
VENUE_LIST_URL = f"{_wolt_base.VENUE_LIST_BASE}/carrefour-all"

# Pinned venue + probe coordinate (see module docstring). Change VENUE_SLUG to
# re-pin to a different Carrefour venue/city.
VENUE_SLUG = "carrefour-jerozolimskie"
VENUE_LAT = _wolt_base.DEFAULT_WARSAW_LAT
VENUE_LON = _wolt_base.DEFAULT_WARSAW_LON


class CarrefourPLScraper(WoltVenueScraper):
    STORE_NAME = "Carrefour"

    def __init__(self):
        super().__init__(
            store_name="Carrefour",
            venue_slug=VENUE_SLUG,
            venue_list_url=VENUE_LIST_URL,
            search_term="carrefour",
            lat=VENUE_LAT,
            lon=VENUE_LON,
        )
