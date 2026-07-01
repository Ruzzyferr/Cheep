import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pytest
from countries._common.category import canonical_category, assert_valid_products


def test_canonical_category_case_insensitive():
    m = {"milch & käse": "dairy", "getränke": "beverages"}
    assert canonical_category("Milch & Käse", m) == "dairy"
    assert canonical_category("GETRÄNKE", m) == "beverages"
    assert canonical_category("unknown", m) is None
    assert canonical_category(None, m) is None


def test_assert_valid_products_accepts_good_dicts():
    good = [{"name": "Milch", "price": 1.5, "unit": "l", "country_code": "DE", "barcode": "40084004"}]
    assert_valid_products(good, require_barcode=True)  # no raise


def test_assert_valid_products_rejects_bad():
    with pytest.raises(AssertionError):
        assert_valid_products([{"name": "", "price": 1.0, "unit": "l", "country_code": "DE"}])
    with pytest.raises(AssertionError):
        assert_valid_products([{"name": "X", "price": 0, "unit": "l", "country_code": "DE"}])
    with pytest.raises(AssertionError):
        assert_valid_products([{"name": "X", "price": 1, "unit": "l"}])  # missing country_code
    with pytest.raises(AssertionError):
        assert_valid_products([{"name": "X", "price": 1, "unit": "l", "country_code": "DE", "barcode": "abc"}], require_barcode=True)
