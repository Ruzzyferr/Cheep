"""Macaristan Árfigyelő okuyucusunun saf fonksiyonları.

Fixture'lar GERÇEK günlük dökümden alındı (2026-08-28) —
countries/hungary/fixtures/.
"""
import json
from pathlib import Path

import pytest

from countries.hungary.scrapers.arfigyelo import (
    COL_CHAIN,
    COL_MAX_PRICE,
    COL_MIN_PRICE,
    build_products,
    flatten_category_paths,
    parse_hu_number,
)

FIXTURES = Path(__file__).resolve().parents[1] / "countries" / "hungary" / "fixtures"


def _rows():
    return json.loads((FIXTURES / "arfigyelo_rows_sample.json").read_text(encoding="utf-8"))


def _categories():
    return json.loads((FIXTURES / "arfigyelo_categories_sample.json").read_text(encoding="utf-8"))


# ------------------------------------------------------------ sayı ayrıştırma

def test_hungarian_decimal_comma_is_parsed():
    """Döküm fiyatları '499,0000' biçiminde — VİRGÜL ondalık ayracı.
    Naif bir float() çağrısı bu ülkenin TÜM fiyatlarını düşürürdü."""
    assert parse_hu_number("499,0000") == 499.0
    assert parse_hu_number("1059,5000") == 1059.5


def test_numeric_values_pass_through():
    assert parse_hu_number(1699) == 1699.0
    assert parse_hu_number(12.5) == 12.5


@pytest.mark.parametrize("value", [None, "", "   ", "n/a", "abc"])
def test_unparseable_numbers_return_none(value):
    assert parse_hu_number(value) is None


def test_non_breaking_space_is_stripped():
    """Excel dışa aktarımlarında bölünmez boşluk sık görülür."""
    assert parse_hu_number("1\xa0699,00") == 1699.0


# --------------------------------------------------------- kategori ağacı

def test_only_leaves_are_flattened():
    """Ara düğümler yol sözlüğüne GİRMEMELİ — XLSX yalnızca yaprak id'si
    taşıyor, ara düğüm id'si oraya hiç gelmiyor."""
    paths = flatten_category_paths(_categories())
    assert paths
    assert all("/" in p for p in paths.values())
    # Bilinen bir yaprak (fixture'daki ilk üst dal).
    assert paths.get("1") == "tejtermek_sajt_tojas/tej/esl_28"


def test_flatten_handles_empty_payload():
    assert flatten_category_paths({}) == {}
    assert flatten_category_paths({"categories": []}) == {}


# --------------------------------------------------------------- ürün üretimi

def test_rows_are_filtered_to_the_requested_chain():
    """Tek döküm SEKİZ zinciri birden içeriyor; her scraper yalnızca kendi
    satırlarını almalı, yoksa her zincire tüm ülkenin kataloğu yazılır."""
    rows = _rows()
    built = build_products(rows, "Tesco", {})
    assert built
    chains = {r[COL_CHAIN] for r in rows}
    assert len(chains) > 1, "fixture birden çok zincir içermeli"
    assert len(built) < len(rows)


def test_minimum_price_is_published_not_maximum():
    """Zincir bazlı min/max bandında MİNİMUM yayınlanıyor: gerçekten ödenen
    bir fiyat. Orta nokta hiçbir mağazada geçerli olmayan uydurma bir sayı
    olurdu."""
    band_rows = [r for r in _rows() if r[COL_MIN_PRICE] != r[COL_MAX_PRICE]]
    assert band_rows, "fixture min!=max olan en az bir satır içermeli"
    row = band_rows[0]
    (product,) = build_products([row], row[COL_CHAIN], {})
    assert product.price == parse_hu_number(row[COL_MIN_PRICE])
    assert product.price < parse_hu_number(row[COL_MAX_PRICE])


def test_category_path_is_used_when_known():
    rows = [r for r in _rows() if r[COL_CHAIN] == "Tesco"]
    paths = {r["Kategória azonosító"]: "zoldseg_gyumolcs/zoldseg/sargarepa" for r in rows}
    built = build_products(rows, "Tesco", paths)
    assert all(p.raw_category == "zoldseg_gyumolcs/zoldseg/sargarepa" for p in built)


def test_falls_back_to_category_name_when_path_unknown():
    """Kaynak yeni bir yaprak eklerse ürün kategorisiz KALMAMALI — hiç
    olmazsa yaprak adı taşınır ve pipeline'ın eşlenmemiş-kategori raporunda
    görünür."""
    row = dict(_rows()[0])
    (product,) = build_products([row], row[COL_CHAIN], {})
    assert product.raw_category == row["Kategória név"]


def test_brand_is_left_none_not_guessed():
    """Dökümde marka sütunu YOK. Ad içinden marka tahmin etmek yanlış
    marketler-arası birleştirme üretir."""
    rows = _rows()
    assert all(p.brand is None for p in build_products(rows, rows[0][COL_CHAIN], {}))


def test_sku_is_chain_scoped():
    """product_id yalnızca zincir içinde benzersiz; çıplak kullanmak iki
    zincirin ürününü aynı satıra yazardı."""
    rows = [r for r in _rows() if r[COL_CHAIN] == "Tesco"]
    for p in build_products(rows, "Tesco", {}):
        assert p.sku.startswith("Tesco:")


def test_zero_and_missing_prices_are_skipped():
    base = dict(_rows()[0])
    bad = dict(base, **{COL_MIN_PRICE: "0,0000"})
    missing = dict(base, **{COL_MIN_PRICE: None})
    assert build_products([bad, missing], base[COL_CHAIN], {}) == []


def test_nameless_row_is_skipped():
    row = dict(_rows()[0], **{"Termék név": "   "})
    assert build_products([row], row[COL_CHAIN], {}) == []


def test_unknown_chain_yields_nothing():
    assert build_products(_rows(), "NincsIlyenLánc", {}) == []
