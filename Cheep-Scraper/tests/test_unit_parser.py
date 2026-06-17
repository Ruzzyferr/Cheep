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
    # the * separator must work too (was silently treated as a single 180 ml)
    assert parse_quantity_and_unit("6*180 ml") == (1080.0, "ml")
    assert parse_quantity_and_unit("Nesquik Kakaolu Süt 6*180 ml") == (1080.0, "ml")


def test_parse_fallback():
    assert parse_quantity_and_unit("") == (1.0, "adet")
    assert parse_quantity_and_unit("paket") == (1.0, "adet")


def test_extract_size_from_name():
    assert extract_size_from_name("Migros %3 Yağlı Uht Süt 1 L") == (1.0, "l")
    assert extract_size_from_name("Eti Burçak Bisküvi 500 g") == (500.0, "g")
    assert extract_size_from_name("İçim Ayran 6x200 ml") == (1200.0, "ml")
    # no size token -> piece
    assert extract_size_from_name("Domates") == (1.0, "adet")


def test_extract_count_packs():
    assert extract_size_from_name("Yumurta 10'lu") == (10.0, "adet")
    assert extract_size_from_name("Selpak Tuvalet Kağıdı 32'li") == (32.0, "adet")
    assert extract_size_from_name("Cif Krem 24'lük Koli") == (24.0, "adet")


def test_count_pack_with_size_is_total_so_packs_dont_match_singles():
    # a small count (<=12) is a per-unit multipack -> TOTAL content
    assert extract_size_from_name("İçim Ayran 6'lı 200 ml") == (1200.0, "ml")
    assert extract_size_from_name("Coca-Cola 1,5 L 6'lı") == (9.0, "l")
    # a large count with a gram size is the TOTAL weight (100 tea bags = 320 g)
    assert extract_size_from_name("Lipton 100'lü 320 g") == (320.0, "g")


def test_multipack_separators_and_pack_count():
    from scrapers.units import extract_size_and_pack
    assert extract_size_and_pack("6*180 ml") == (1080.0, "ml", 6)
    assert extract_size_and_pack("6 x 200 ml") == (1200.0, "ml", 6)
    assert extract_size_and_pack("İçim Ayran 6'lı 200 ml") == (1200.0, "ml", 6)
    assert extract_size_and_pack("Lipton 100'lü 320 g") == (320.0, "g", 100)
    assert extract_size_and_pack("Süt 1 L") == (1.0, "l", 1)


def test_size_signature_separates_packs_from_singles():
    from scrapers.matching import size_signature
    single = size_signature("Coca-Cola Zero 1,5 L", 1.5, "l")
    six = size_signature("Coca-Cola Zero 1,5 L 6'lı", 1.5, "l")
    assert single != six                 # 6-pack must not bucket with a single
    assert single == size_signature("Coca-Cola Zero 1500 ml", 1500, "ml")


def test_compute_unit_price():
    # 30 TL for 1.5 L -> 20 TL/l
    assert compute_unit_price(Decimal("30"), 1.5, "l") == (Decimal("20.00"), "l")
    # 6 TL for 500 g -> 12 TL/kg
    assert compute_unit_price(Decimal("6"), 500.0, "g") == (Decimal("12.00"), "kg")
    # 4 TL for 250 ml -> 16 TL/l
    assert compute_unit_price(Decimal("4"), 250.0, "ml") == (Decimal("16.00"), "l")
    # piece -> per adet
    assert compute_unit_price(Decimal("5"), 1.0, "adet") == (Decimal("5.00"), "adet")
