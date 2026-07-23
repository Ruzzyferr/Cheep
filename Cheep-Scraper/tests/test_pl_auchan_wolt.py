"""Tests for the Auchan (Poland) Wolt hypermarket consumer-API scraper.

2026-07-23 rewrite: the direct zakupy.auchan.pl scraper had never succeeded
from the production droplet (the product API serves datacenter IPs an empty
HTTP 202 — see auchan_wolt.py's module docstring), so Auchan now sources from
Wolt via the shared `WoltVenueScraper` base.

The base's behavior (parsing, pagination, dedup, error isolation, venue
re-discovery) is exhaustively covered by test_pl_carrefour_wolt.py /
test_pl_zabka_wolt.py; auchan_wolt.py is a pure wiring subclass, so these
tests only pin the wiring: the class instantiates with the right venue
constants, and config.json actually points the Auchan market at it (the exact
failure mode this rewrite fixes was a scraper that LOOKED configured but never
produced data in prod).
"""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
PL_DIR = ROOT / "countries" / "poland"


def _load_pl_scraper_module(name: str):
    """Load countries/poland/scrapers/<name>.py by absolute file path (see
    test_pl_zabka_wolt.py for why: the country's own `scrapers` dir collides
    with the repo-root package name)."""
    path = PL_DIR / "scrapers" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"pl_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_auchan_wolt_scraper_instantiates_and_exposes_fetch_products():
    mod = _load_pl_scraper_module("auchan_wolt")
    scraper = mod.AuchanWoltScraper()
    assert scraper.store_name == "Auchan"
    assert callable(scraper.fetch_products)
    assert scraper.venue_slug == "auchan-wolla"
    assert scraper.search_term == "auchan"
    assert mod.VENUE_LIST_URL.endswith("/auchan-all")


def test_config_points_auchan_market_at_the_wolt_scraper():
    config = json.loads((PL_DIR / "config.json").read_text(encoding="utf-8"))
    auchan = next(m for m in config["markets"] if m["name"] == "Auchan")
    assert auchan["enabled"] is True
    assert auchan["scraper_path"] == "scrapers/auchan_wolt.py"
    assert auchan["scraper_class"] == "AuchanWoltScraper"
    # the configured path must actually load and expose the configured class
    # with the configured method (exactly what the runner will do).
    scraper_file = PL_DIR / "scrapers" / Path(auchan["scraper_path"]).name
    assert scraper_file.exists()
    mod = _load_pl_scraper_module(scraper_file.stem)
    cls = getattr(mod, auchan["scraper_class"])
    assert callable(getattr(cls(), auchan["scraper_method"]))


def test_config_auchan_deny_prefixes_match_wolt_category_names():
    """The deny list was rebuilt against the Wolt venue's tree — the old
    zakupy.auchan.pl department names ('Auto-Moto/', 'Artykuły dla domu/',
    'Dziecko i Mama/...') must be gone, and the household-consumable leaves of
    'Artykuły domowe' must NOT be denied."""
    config = json.loads((PL_DIR / "config.json").read_text(encoding="utf-8"))
    auchan = next(m for m in config["markets"] if m["name"] == "Auchan")
    deny = auchan["category_deny_prefixes"]
    assert "Zabawki/" in deny
    assert "Artykuły biurowe/" in deny
    for stale in ("Auto-Moto/", "Artykuły biurowe i szkolne/", "Artykuły dla domu/",
                  "Dziecko i Mama/Zabawki/"):
        assert stale not in deny
    kept_consumables = [
        "Artykuły domowe/Środki czystości",
        "Artykuły domowe/Środki do prania",
        "Artykuły domowe/Worki na śmieci",
        "Artykuły domowe/Ręczniki papierowe",
    ]
    for consumable in kept_consumables:
        assert not any(consumable.startswith(d) for d in deny), consumable
