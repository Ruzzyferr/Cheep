"""Hırvatistan cijene.dev okuyucusunun saf fonksiyonları.

Fixture'lar GERÇEK arşivden alındı (2026-08-28, Konzum) —
countries/croatia/fixtures/.
"""
import csv
import io
import json
from pathlib import Path

import pytest

from countries.croatia.scrapers.cijene_base import (
    build_products,
    clean_barcode,
    latest_archive_url,
    parse_quantity_field,
    pick_reference_store,
)

FIXTURES = Path(__file__).resolve().parents[1] / "countries" / "croatia" / "fixtures"


def _rows(name):
    return list(csv.DictReader(io.StringIO((FIXTURES / name).read_text(encoding="utf-8"))))


# ------------------------------------------------------- arşiv seçimi

def test_latest_archive_is_picked_by_date_not_list_order():
    """Fixture BİLEREK karışık sıralı (26, 28, 27). Liste sırasına güvenmek,
    kaynak sırayı değiştirdiğinde sessizce ESKİ günü indirmek demektir —
    fiyatların donduğunu gizleyen tam da o sessiz arıza sınıfı."""
    payload = json.loads((FIXTURES / "cijene_list_sample.json").read_text(encoding="utf-8"))
    url, day = latest_archive_url(payload)
    assert day == "2026-08-28"
    assert url.endswith("2026-08-28.zip")


def test_empty_archive_list_raises():
    with pytest.raises(ValueError):
        latest_archive_url({"archives": []})


def test_archive_entry_without_url_raises():
    with pytest.raises(ValueError):
        latest_archive_url({"archives": [{"date": "2026-08-28"}]})


# ------------------------------------------------- referans mağaza seçimi

def test_reference_store_is_the_largest_catalog():
    """Kullanıcıya en çok ürünü gösteren mağaza seçilmeli."""
    counts = {"0001": 5000, "0005": 12000, "0010": 900}
    stores = {k: {"city": "Zagreb"} for k in counts}
    assert pick_reference_store(counts, stores) == "0005"


def test_reference_store_tie_breaks_on_preferred_city():
    counts = {"0001": 10000, "0005": 10000}
    stores = {"0001": {"city": "Osijek"}, "0005": {"city": "Zagreb"}}
    assert pick_reference_store(counts, stores) == "0005"


def test_reference_store_is_deterministic_on_full_tie():
    """Determinizm ŞART: seçim koşudan koşuya oynarsa aynı ürünün fiyatı
    mağaza değiştiği için sıçrar, fiyat geçmişi ve düşüş bildirimleri yalan
    söyler."""
    counts = {"0009": 100, "0002": 100, "0005": 100}
    stores = {k: {"city": "Zagreb"} for k in counts}
    assert pick_reference_store(counts, stores) == "0002"
    assert pick_reference_store(counts, stores) == "0002"


def test_no_prices_yields_no_reference_store():
    assert pick_reference_store({}, {}) is None


# ------------------------------------------------------------- barkod

def test_real_ean_passes_through():
    assert clean_barcode("3856021300547") == "3856021300547"


def test_synthetic_chain_scoped_code_is_dropped():
    """cijene.dev EAN yoksa '<zincir>:<id>' yazıyor. Bu kod ZİNCİRE ÖZEL —
    barkod diye iletmek iki zincirin alakasız ürünlerini birleştirebilirdi."""
    assert clean_barcode("konzum:01310113") is None


@pytest.mark.parametrize("value", ["", None, "   ", "abc123"])
def test_non_numeric_barcodes_are_dropped(value):
    assert clean_barcode(value) is None


# ------------------------------------------------------- miktar / birim

def test_quantity_field_is_used_when_meaningful():
    qty, unit = parse_quantity_field("0.20 kg", "ČIPI ČIPS 200g FRANCK")
    assert (qty, unit) == (0.2, "kg")


def test_falls_back_to_name_when_quantity_field_is_empty():
    qty, unit = parse_quantity_field("", "SIR DUKAT 250g")
    assert (qty, unit) == (250.0, "g")


def test_multipack_in_name_is_not_undercounted():
    """'2x75 g' tek bardaklık 75 g değil, 150 g'lık pakettir. Polonya'da
    Wolt'un `unit_info`'su bu hatayı yapıyordu."""
    qty, unit = parse_quantity_field("", "SNICKERS 2x75 g")
    assert unit == "g"
    assert qty == 150.0


# --------------------------------------------------- ürün + fiyat birleşimi

def test_products_are_joined_to_reference_store_prices():
    products = _rows("konzum_products_sample.csv")
    price_rows = {r["product_id"]: r for r in _rows("konzum_prices_sample.csv")
                  if r["store_id"] == "0001"}
    built = build_products(products, price_rows)
    assert built, "fixture'dan en az bir ürün çıkmalı"
    for p in built:
        assert p.price > 0
        assert p.name
        assert p.sku


def test_product_without_price_in_reference_store_is_skipped():
    """Katalogda duran ama o mağazada satılmayan ürünü fiyatsız yayınlamak
    kullanıcıya OLMAYAN bir raf gösterir."""
    products = [{"product_id": "X1", "name": "TEST", "barcode": "", "brand": "",
                 "category": "HRANA", "unit": "ko", "quantity": ""}]
    assert build_products(products, {}) == []


def test_special_price_wins_over_regular_price():
    """İndirim varsa RAFTA ÖDENEN fiyat odur."""
    products = [{"product_id": "X1", "name": "TEST 1kg", "barcode": "", "brand": "",
                 "category": "HRANA", "unit": "ko", "quantity": "1 kg"}]
    prices = {"X1": {"price": "9.99", "special_price": "6.49"}}
    (p,) = build_products(products, prices)
    assert p.price == 6.49


def test_zero_and_malformed_prices_are_skipped():
    products = [
        {"product_id": "A", "name": "SIFIR", "category": "HRANA", "quantity": ""},
        {"product_id": "B", "name": "BOZUK", "category": "HRANA", "quantity": ""},
        {"product_id": "C", "name": "IYI 1kg", "category": "HRANA", "quantity": "1 kg"},
    ]
    prices = {
        "A": {"price": "0", "special_price": ""},
        "B": {"price": "n/a", "special_price": ""},
        "C": {"price": "3.20", "special_price": ""},
    }
    built = build_products(products, prices)
    assert [p.name for p in built] == ["IYI 1kg"]


def test_nameless_product_is_skipped():
    products = [{"product_id": "A", "name": "   ", "category": "HRANA", "quantity": ""}]
    assert build_products(products, {"A": {"price": "1.00"}}) == []


def test_classifier_output_lands_in_raw_category():
    products = [{"product_id": "A", "name": "SIR DUKAT 250g", "category": "HRANA",
                 "quantity": "0.25 kg", "brand": "DUKAT", "barcode": "3856021300547"}]
    prices = {"A": {"price": "4.99", "special_price": ""}}
    (p,) = build_products(products, prices, classifier=lambda n, c: "Sir")
    assert p.raw_category == "Sir"
    assert p.brand == "DUKAT"
    assert p.barcode == "3856021300547"
