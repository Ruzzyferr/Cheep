"""Chain-rotation scheduling: pure market-selection logic used by
countries/_common/pipeline.py's --markets CLI flag (task 22). Spreads PL's
Auchan/Biedronka/Lidl/Żabka refresh across the week instead of hammering
every enabled chain in one nightly run."""
import pytest

from countries._common.pipeline import select_markets

CONFIG_MARKETS = [
    {"name": "Carrefour", "enabled": False},
    {"name": "Auchan", "enabled": True},
    {"name": "Kaufland", "enabled": False},
    {"name": "Biedronka", "enabled": True},
    {"name": "Lidl", "enabled": True},
    {"name": "Dino", "enabled": False},
    {"name": "Żabka", "enabled": True},
]


def test_none_returns_all_enabled_markets_in_config_order():
    selected = select_markets(CONFIG_MARKETS, None)
    assert [m["name"] for m in selected] == ["Auchan", "Biedronka", "Lidl", "Żabka"]


def test_subset_returns_only_named_markets():
    selected = select_markets(CONFIG_MARKETS, ["Żabka"])
    assert [m["name"] for m in selected] == ["Żabka"]


def test_subset_preserves_requested_order_and_multiple_names():
    selected = select_markets(CONFIG_MARKETS, ["Lidl", "Żabka"])
    assert [m["name"] for m in selected] == ["Lidl", "Żabka"]


def test_unknown_market_name_raises():
    with pytest.raises(ValueError):
        select_markets(CONFIG_MARKETS, ["Netflix"])


def test_disabled_market_name_raises_not_silently_skipped():
    """A rotation day naming a disabled market (e.g. a typo, or a market
    that got disabled after the rotation table was written) must be a hard
    error, not a silent skip -- silently running nothing/fewer markets than
    intended is exactly the failure mode this flag exists to prevent."""
    with pytest.raises(ValueError):
        select_markets(CONFIG_MARKETS, ["Carrefour"])


def test_never_returns_a_disabled_market_even_mixed_with_enabled():
    with pytest.raises(ValueError):
        select_markets(CONFIG_MARKETS, ["Auchan", "Kaufland"])


def test_empty_names_list_returns_no_markets():
    """An empty --markets list (as opposed to omitted/None) is a valid
    'run nothing' request, e.g. a rotation day with no markets scheduled
    that still wants to exercise the CLI path explicitly."""
    assert select_markets(CONFIG_MARKETS, []) == []
