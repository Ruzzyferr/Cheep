from countries._common.pipeline import should_import, summary_is_healthy


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
