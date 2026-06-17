"""Tests for robust quantity/unit parsing and unit-price computation."""
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scrapers.units import (  # noqa: E402
    normalize_unit,
    parse_quantity_and_unit,
    extract_size_from_name,
    compute_unit_price,
)


def test_normalize_unit():
    assert normalize_unit("GR") == "g"
    assert normalize_unit("gram") == "g"
    assert normalize_unit("Kilogram") == "kg"
    assert normalize_unit("LT") == "l"
    assert normalize_unit("litre") == "l"
    assert normalize_unit("ML") == "ml"
    assert normalize_unit("adet") == "adet"
    assert normalize_unit("PIECE") == "adet"


def test_parse_simple():
    assert parse_quantity_and_unit("1 kg") == (1.0, "kg")
    assert parse_quantity_and_unit("500 g") == (500.0, "g")
    assert parse_quantity_and_unit("500ml") == (500.0, "ml")
    assert parse_quantity_and_unit("1 L") == (1.0, "l")


def test_parse_decimal_comma():
    assert parse_quantity_and_unit("1,5 L") == (1.5, "l")
    assert parse_quantity_and_unit("0,75 lt") == (0.75, "l")


def test_parse_multipack():
    # 2x200 g -> 400 g
    assert parse_quantity_and_unit("2x200 g") == (400.0, "g")
    # 6 x 1 L -> 6 L
    assert parse_quantity_and_unit("6 x 1 L") == (6.0, "l")


def test_parse_fallback():
    assert parse_quantity_and_unit("") == (1.0, "adet")
    assert parse_quantity_and_unit("paket") == (1.0, "adet")


def test_extract_size_from_name():
    assert extract_size_from_name("Migros %3 Yağlı Uht Süt 1 L") == (1.0, "l")
    assert extract_size_from_name("Eti Burçak Bisküvi 500 g") == (500.0, "g")
    assert extract_size_from_name("İçim Ayran 6x200 ml") == (1200.0, "ml")
    # no size token -> piece
    assert extract_size_from_name("Domates") == (1.0, "adet")


def test_compute_unit_price():
    # 30 TL for 1.5 L -> 20 TL/l
    assert compute_unit_price(Decimal("30"), 1.5, "l") == (Decimal("20.00"), "l")
    # 6 TL for 500 g -> 12 TL/kg
    assert compute_unit_price(Decimal("6"), 500.0, "g") == (Decimal("12.00"), "kg")
    # 4 TL for 250 ml -> 16 TL/l
    assert compute_unit_price(Decimal("4"), 250.0, "ml") == (Decimal("16.00"), "l")
    # piece -> per adet
    assert compute_unit_price(Decimal("5"), 1.0, "adet") == (Decimal("5.00"), "adet")
