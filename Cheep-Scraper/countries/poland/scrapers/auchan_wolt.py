"""Auchan (Poland) scraper — Wolt hypermarket consumer API.

Thin subclass of the shared `WoltVenueScraper` (see `wolt_base.py` for the full
endpoint model, item schema, quantity-parsing caveat, and hardening notes).

REWRITE (2026-07-23). The previous direct-site scraper (`auchan_pl.py`, the
zakupy.auchan.pl `webproductpagews` v6 department crawl) worked from
residential IPs but was found to have NEVER succeeded from the production
droplet: zakupy.auchan.pl serves its product API endpoints (v5/v6
product-pages) an empty `202` to datacenter IPs (verified live 2026-07-23 —
the same curl returns full JSON from a residential IP and `202 0` from the
droplet; the unauthenticated `/v1/categories` taxonomy endpoint is NOT behind
that WAF, which is why the crawl "discovered 11 departments" and then got zero
products every night). A homepage-first cookie-jar flow does not unblock it —
it is IP-reputation gating, not a challenge flow, so no request-shaping fix
exists from the droplet.

Auchan's real online catalog is ALSO fully reachable on Wolt: Auchan runs its
Warsaw hypermarkets as storefront venues on Wolt's unauthenticated, plain-JSON
`consumer-api.wolt.com` — the exact same surface Carrefour (store 40,
`carrefour_pl.py`) and Żabka (store 47, `zabka.py`) already ride on, and which
is verified reachable from the droplet nightly. This scraper replaces the
direct-site path in config.json; `auchan_pl.py` is kept on disk (with its
fixture tests) as documentation of the direct-site protocol in case the WAF
posture ever changes.

The pinned venue is **Auchan Wola** (slug `auchan-wolla`), chosen 2026-07-23 as
the largest of the 15+ Warsaw Auchan venues surveyed via the venue search
(42 top-level / 361 leaf categories — bigger than Carrefour Jerozolimskie's
35/319, which yields ~11.6k raw products). Wolt items carry `barcode_gtin`
(EAN) on the large majority of grocery items — a strict upgrade over the
direct-site feed, which had no EANs at all (Auchan was an EAN-harvest
*receiver*; on Wolt it becomes largely self-sufficient). If the pinned slug
ever 404s, `fetch_products()` falls back to re-discovering a live Auchan venue
via the brand roll-up `GET /v1/pages/venue-list/auchan-all` (then an `auchan`
venue search).

One-store pricing scope: a single Warsaw hypermarket venue's prices, not a
synthesized national catalog — the same one-store snapshot model as every
other PL chain. Non-grocery departments (Zabawki/toys, Artykuły
biurowe/office, Ogród/garden, the durable leaves of Artykuły domowe, …) are
excluded downstream via config.json `category_deny_prefixes`, the same
mechanism the old direct-site Auchan entry used (the prefix list was rebuilt
2026-07-23 against this venue's live category tree — Wolt's category names
differ from zakupy.auchan.pl's).
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
# Re-exported for parity with zabka.py/carrefour_pl.py.
ASSORTMENT_BASE = _wolt_base.ASSORTMENT_BASE
CONSUMER_API_BASE = _wolt_base.CONSUMER_API_BASE
VENUE_LIST_URL = f"{_wolt_base.VENUE_LIST_BASE}/auchan-all"

# Pinned venue + probe coordinate (see module docstring). Change VENUE_SLUG to
# re-pin to a different Auchan venue/city.
VENUE_SLUG = "auchan-wolla"
VENUE_LAT = _wolt_base.DEFAULT_WARSAW_LAT
VENUE_LON = _wolt_base.DEFAULT_WARSAW_LON


class AuchanWoltScraper(WoltVenueScraper):
    STORE_NAME = "Auchan"

    def __init__(self):
        super().__init__(
            store_name="Auchan",
            venue_slug=VENUE_SLUG,
            venue_list_url=VENUE_LIST_URL,
            search_term="auchan",
            lat=VENUE_LAT,
            lon=VENUE_LON,
        )
