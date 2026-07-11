"""Żabka (Poland) scraper — Wolt "Żabka Jush" dark-store consumer API.

Thin subclass of the shared `WoltVenueScraper` (see `wolt_base.py` for the full
endpoint model, item schema, quantity-parsing caveat, and hardening notes).

REWRITE (2026-07-11, task 24). This REPLACES the previous homepage-carousel
approach (zabka.pl's "this week's offers" widget, ~8 hand-picked tiles with no
barcode/EAN at all). Recon (task 23,
`.superpowers/sdd/task-23-lidl-zabka-recon.md`) found that Żabka's real online
catalog is not on zabka.pl or jush.pl at all: Żabka runs its quick-commerce arm
"Żabka Jush!" as dark-store delivery venues on Wolt, reachable through Wolt's
plain-JSON `consumer-api.wolt.com` with NO authentication. A single Warsaw venue
exposed **2,128 unique SKUs** (full catalog, not a leaflet/promo subset) across
138 leaf categories, with **98.5% carrying a `barcode_gtin` (EAN)** — a
categorically better source than the old carousel or lidl.pl's own search API.

Pinned venue (MVP one-store pricing scope — see wolt_base.py docstring): Żabka
Jush - Śródmieście, central Warsaw, slug `zabka-jush-srodmiescie`, discovered
via `POST /v1/pages/search {"q":"zabka","target":"venues"}` from central Warsaw
during recon. `VENUE_SLUG` / `VENUE_LIST_URL` are module constants so re-pinning
is a one-line change; if the pinned slug ever 404s, `fetch_products()` falls
back to re-discovering a live Żabka Jush venue via the brand roll-up
`GET /v1/pages/venue-list/zabkajush-all` (then a `zabka jush` venue search).

Alcohol categories (Piwa/beer, Alkohole mocne/spirits, Wina/wine — each 18+
gated) are NOT dropped here; they are excluded downstream by config.json's
`category_deny_prefixes`, matched against `raw_category`, same as Auchan/Lidl PL.

Class name (`ZabkaScraper`) and `fetch_products()` signature are unchanged so
the config.json runner keeps working.
"""
import importlib.util
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent


def _load_sibling_module(name: str):
    """Load a sibling scraper module (e.g. wolt_base.py) by absolute file path.

    A plain `import wolt_base` is unreliable here: this file is loaded by the
    runner/tests via `spec_from_file_location`, and countries/poland/scrapers is
    not guaranteed to be on sys.path. Loading by explicit path (under a stable
    private key so the shared base is a singleton across sibling scrapers)
    sidesteps that entirely."""
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
# Re-exported so existing tests (and any external caller) can reference
# zabka.ASSORTMENT_BASE / zabka.VENUE_LIST_URL at module scope.
ASSORTMENT_BASE = _wolt_base.ASSORTMENT_BASE
CONSUMER_API_BASE = _wolt_base.CONSUMER_API_BASE
VENUE_LIST_URL = f"{_wolt_base.VENUE_LIST_BASE}/zabkajush-all"

# Pinned venue + probe coordinate (see module docstring). Change VENUE_SLUG to
# re-pin to a different city/venue.
VENUE_SLUG = "zabka-jush-srodmiescie"
VENUE_LAT = _wolt_base.DEFAULT_WARSAW_LAT
VENUE_LON = _wolt_base.DEFAULT_WARSAW_LON


class ZabkaScraper(WoltVenueScraper):
    STORE_NAME = "Żabka"

    def __init__(self):
        super().__init__(
            store_name="Żabka",
            venue_slug=VENUE_SLUG,
            venue_list_url=VENUE_LIST_URL,
            search_term="zabka jush",
            lat=VENUE_LAT,
            lon=VENUE_LON,
        )
