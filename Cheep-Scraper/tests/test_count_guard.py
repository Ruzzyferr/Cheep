from countries._common.pipeline import (
    should_import,
    summary_is_healthy,
    filter_products_by_category_domain,
    resolve_enrich_mode,
)


def test_collapse_blocks_import():
    assert should_import("Biedronka", new_count=40, prev_counts={"Biedronka": 100}) is False


def test_normal_fluctuation_passes():
    assert should_import("Biedronka", new_count=85, prev_counts={"Biedronka": 100}) is True


def test_first_run_always_passes():
    assert should_import("Biedronka", new_count=10, prev_counts={}) is True


def test_summary_healthy_when_all_markets_ok():
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Biedronka", "successful": 100, "failed": 0},
            {"market": "Lidl", "successful": 80, "failed": 0},
        ],
    }
    assert summary_is_healthy(summary) is True


def test_summary_unhealthy_when_market_skipped():
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Biedronka", "successful": 100, "failed": 0},
            {"market": "Lidl", "skipped": "count_collapse"},
        ],
    }
    assert summary_is_healthy(summary) is False


def test_summary_unhealthy_when_market_has_failures():
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Biedronka", "successful": 90, "failed": 10},
        ],
    }
    assert summary_is_healthy(summary) is False


def test_summary_healthy_with_single_failure_within_tolerance():
    # 2026-07-23: 1 malformed item out of 1,003 (prod Biedronka 2026-07-21)
    # must NOT cancel the nightly prune + EAN harvest — tolerate up to
    # max(1, 1%) failed imports per market.
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Biedronka", "successful": 1002, "failed": 1},
        ],
    }
    assert summary_is_healthy(summary) is True


def test_summary_healthy_at_one_percent_failure_boundary():
    # 10 failed of 1000 attempted == exactly the 1% allowance -> healthy;
    # 11 of 1001 -> over the allowance -> unhealthy.
    at_boundary = {
        "country": "PL",
        "markets": [{"market": "Carrefour", "successful": 990, "failed": 10}],
    }
    over_boundary = {
        "country": "PL",
        "markets": [{"market": "Carrefour", "successful": 990, "failed": 11}],
    }
    assert summary_is_healthy(at_boundary) is True
    assert summary_is_healthy(over_boundary) is False


def test_summary_unhealthy_when_only_failures():
    # failed>0 with successful==0 is a collapsed market, never tolerated —
    # the min-1 allowance must not mask a market that imported nothing.
    summary = {
        "country": "PL",
        "markets": [
            {"market": "Auchan", "successful": 0, "failed": 1},
        ],
    }
    assert summary_is_healthy(summary) is False


def test_summary_unhealthy_when_no_markets():
    summary = {"country": "PL", "markets": []}
    assert summary_is_healthy(summary) is False


def test_no_filters_keeps_everything_unchanged():
    products = [{"name": "Spodnie", "raw_category": "Kategorie/Moda/Dżinsy"}]
    kept, stats = filter_products_by_category_domain(products)
    assert kept == products
    assert stats == {"kept": 1, "dropped": 0}


def test_allow_prefix_keeps_matching_drops_rest():
    products = [
        {"name": "Jabłka", "raw_category": "Światy potrzeb/Żywność/Owoce"},
        {"name": "Spodnie", "raw_category": "Kategorie/Moda/Dżinsy"},
    ]
    kept, stats = filter_products_by_category_domain(products, allow_prefixes=["Światy potrzeb/Żywność"])
    assert [p["name"] for p in kept] == ["Jabłka"]
    assert stats == {"kept": 1, "dropped": 1}


def test_deny_prefix_drops_matching_keeps_rest():
    products = [
        {"name": "Wiertarka", "raw_category": "Kategorie/Warsztat/Narzędzia"},
        {"name": "Jabłka", "raw_category": "Światy potrzeb/Żywność/Owoce"},
    ]
    kept, stats = filter_products_by_category_domain(products, deny_prefixes=["Kategorie/Warsztat"])
    assert [p["name"] for p in kept] == ["Jabłka"]
    assert stats == {"kept": 1, "dropped": 1}


def test_deny_takes_precedence_over_allow():
    """A product matching both an allow and a deny prefix must be dropped —
    deny wins, so a coarse allow list can be safely narrowed by deny rules."""
    products = [{"name": "Chemikalia", "raw_category": "Kategorie/Dom/Chemia/Trujące"}]
    kept, stats = filter_products_by_category_domain(
        products, allow_prefixes=["Kategorie/Dom"], deny_prefixes=["Kategorie/Dom/Chemia"],
    )
    assert kept == []
    assert stats == {"kept": 0, "dropped": 1}


def test_resolve_enrich_mode_bulk():
    assert resolve_enrich_mode({"off_bulk": True}) == "bulk"


def test_resolve_enrich_mode_api():
    assert resolve_enrich_mode({"off_enrich": True}) == "api"


def test_resolve_enrich_mode_none_when_neither_set():
    assert resolve_enrich_mode({}) is None


def test_resolve_enrich_mode_bulk_takes_priority_over_api():
    """Configs should only ever set one of the two flags (off_bulk REPLACES
    off_enrich, it doesn't layer on top of it) — but if both were ever set,
    bulk (the local, non-rate-limited path) must win."""
    assert resolve_enrich_mode({"off_bulk": True, "off_enrich": True}) == "bulk"


def test_products_without_raw_category_are_always_kept():
    """Żabka case: some scrapers never populate raw_category at all — those
    products must survive an allow/deny filter untouched, not get dropped
    for 'not matching' an allow prefix."""
    products = [{"name": "Bułka"}, {"name": "Mleko", "raw_category": None}]
    kept, stats = filter_products_by_category_domain(
        products, allow_prefixes=["Światy potrzeb/Żywność"],
    )
    assert len(kept) == 2
    assert stats == {"kept": 2, "dropped": 0}
