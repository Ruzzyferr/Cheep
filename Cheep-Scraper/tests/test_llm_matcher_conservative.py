"""Tests for the (older) scalable LLM matcher's conservative size handling.

These lock the code-review fixes that make the matcher refuse to merge on size
UNCERTAINTY (a missing/unknown gramaj must BLOCK a merge in a pricing system),
since a false merge manufactures bogus price gaps / "deals".

The module filename has a hyphen, so it is loaded via importlib. The size-compare
helpers are pure methods, so we bypass the network/env-heavy __init__ with
__new__.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_MOD_PATH = ROOT / "scalable-llm-matcher.py"


def _load_matcher_class():
    spec = importlib.util.spec_from_file_location("scalable_llm_matcher", _MOD_PATH)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:  # missing optional deps -> skip rather than fail suite
        pytest.skip(f"scalable-llm-matcher not importable: {e}")
    return mod.ScalableLLMProductMatcher


@pytest.fixture(scope="module")
def matcher():
    cls = _load_matcher_class()
    # Bypass __init__ (needs API keys / env) — the size helpers are pure.
    return cls.__new__(cls)


# --- finding #3: missing/uncertain size must BLOCK a merge ------------------
def test_missing_size_on_one_side_blocks_merge(matcher):
    assert matcher._compare_sizes("1 L", None) is False
    assert matcher._compare_sizes(None, "500 g") is False
    assert matcher._compare_sizes("1 L", "") is False


def test_both_missing_blocks_merge(matcher):
    # two products with no gramaj at all are NOT safe to merge for pricing
    assert matcher._compare_sizes(None, None) is False
    assert matcher._compare_sizes("", "") is False


def test_unknown_vs_unknown_only_compatible_when_identical(matcher):
    # two free-text sizes that normalize to "unknown": fuzzy ">0.5 similarity" no
    # longer permits a merge — only a byte-for-byte identical string does.
    assert matcher._compare_sizes("özel boy", "büyük boy") is False
    assert matcher._compare_sizes("tekli", "tekli") is True


def test_known_equal_sizes_still_compatible(matcher):
    # the conservative change must not break true equality on a single unit
    assert matcher._compare_sizes("500 g", "500 g") is True
    assert matcher._compare_sizes("1 L", "1 lt") is True


def test_known_different_sizes_incompatible(matcher):
    assert matcher._compare_sizes("1 L", "500 ml") is False
    assert matcher._compare_sizes("250 g", "500 g") is False


# --- normalize_size: ml/cl multiplier must NOT double-apply (new finding) ----
def test_normalize_size_ml_is_not_multiplied_like_litre(matcher):
    # REGRESSION: "ml".endswith("l") made every ml/cl match the LITRE conversion
    # (×1000), so "1000 ml" normalized to 1_000_000 ml. ml must stay ml.
    assert matcher.normalize_size("1000 ml") == (1000.0, "ml")
    assert matcher.normalize_size("500 ml") == (500.0, "ml")
    assert matcher.normalize_size("100 ml") == (100.0, "ml")
    # cl is ×10 (not ×1000): 2 cl = 20 ml
    assert matcher.normalize_size("2 cl") == (20.0, "ml")
    # litre still converts to ml correctly
    assert matcher.normalize_size("1 l") == (1000.0, "ml")
    assert matcher.normalize_size("1 litre") == (1000.0, "ml")
    assert matcher.normalize_size("1,5 l") == (1500.0, "ml")
    # mass unaffected
    assert matcher.normalize_size("500 g") == (500.0, "g")
    assert matcher.normalize_size("1 kg") == (1000.0, "g")


def test_normalize_size_free_text_does_not_substring_match_unit(matcher):
    # REGRESSION: free text "l boy" used to substring-match the `l` unit and return
    # (1000, ml). Descriptive text with no real gramaj must be "unknown".
    assert matcher.normalize_size("l boy") == (0, "unknown")
    assert matcher.normalize_size("büyük boy") == (0, "unknown")
    assert matcher.normalize_size("özel boy") == (0, "unknown")
    # but a bare unit token alone is still a valid (default-1) size
    assert matcher.normalize_size("lt") == (1000, "ml")
    assert matcher.normalize_size("ml") == (1, "ml")


def test_normalize_size_ml_equiv_unblocks_true_match(matcher):
    # the ml bug also broke _compare_sizes: "1 L" (1000 ml) vs "1000 ml" used to be
    # 1000 vs 1_000_000 -> wrongly "different". Now they match.
    assert matcher._compare_sizes("1 L", "1000 ml") is True
    assert matcher._compare_sizes("500 ml", "0,5 L") is True
