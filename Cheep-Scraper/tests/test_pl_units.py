import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scrapers.units import parse_quantity_and_unit, normalize_unit
from countries._common.foreign_import import build_api_payloads


def test_polish_unit_tokens():
    assert parse_quantity_and_unit("Jaja z wolnego wybiegu 10 szt.") == (10.0, "szt")
    assert parse_quantity_and_unit("Mleko UHT 1,5 l") == (1.5, "l")
    assert normalize_unit("sztuk") == "szt"
    assert normalize_unit("opakowanie") == "opak"


def test_default_unit_is_country_scoped():
    products = [{"name": "Bułka kajzerka", "price": 0.89}]  # unit yok
    payloads = build_api_payloads(products, store_id=44, default_unit="szt")
    assert payloads[0]["unit"] == "szt"


def test_adet_never_leaks_into_pl_rows():
    products = [{"name": "Masło ekstra", "price": 7.99, "unit": "adet"}]
    payloads = build_api_payloads(products, store_id=44, default_unit="szt")
    assert payloads[0]["unit"] == "szt"


def test_pack_semantics_butter_200g():
    """Butter 200g cost 5.99 zł: unit must be "szt" not "kg" (5x overprice).
    Price is always per-package (shelf price), never per-measure-unit.
    When quantity < 1kg and unit is kg, send default_unit."""
    products = [{
        "name": "Masło ekstra 200 g",
        "price": 5.99,
        "unit": "kg",
        "quantity": 0.2,
    }]
    payloads = build_api_payloads(products, store_id=44, default_unit="szt")
    assert payloads[0]["unit"] == "szt", "sub-kg qty with kg unit must send default"


def test_pack_semantics_milk_1l_exact():
    """Milk UHT exactly 1 l costs 4.28 zł: unit can stay "l" (price-per-liter matches).
    Only swap to default_unit if qty ≠ 1.0."""
    products = [{
        "name": "Mleko UHT 1 l",
        "price": 4.28,
        "unit": "l",
        "quantity": 1.0,
    }]
    payloads = build_api_payloads(products, store_id=44, default_unit="szt")
    assert payloads[0]["unit"] == "l", "unit l with qty=1.0 should pass through"


def test_pack_semantics_cheese_150g():
    """Cheese 150g: unit must be "szt" not "g" (g can never be a price unit).
    Measure units g/ml/cl always indicate package contents, not price-per unit."""
    products = [{
        "name": "Ser żółty 150 g",
        "price": 6.5,
        "unit": "g",
        "quantity": 150.0,
    }]
    payloads = build_api_payloads(products, store_id=44, default_unit="szt")
    assert payloads[0]["unit"] == "szt", "g unit always swaps to default"


def test_pack_semantics_no_quantity_keep_as_is():
    """No quantity evidence: keep unit as-is.
    If scraper omits quantity, assume unit is already price-per (conservative)."""
    products = [{
        "name": "Chleb",
        "price": 3.0,
        "unit": "kg",
    }]
    payloads = build_api_payloads(products, store_id=44, default_unit="szt")
    assert payloads[0]["unit"] == "kg", "no qty means no evidence to swap"
