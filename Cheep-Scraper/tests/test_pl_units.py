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
