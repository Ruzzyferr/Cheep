from countries._common.pipeline import (
    should_import,
    summary_is_healthy,
    filter_products_by_category_domain,
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
