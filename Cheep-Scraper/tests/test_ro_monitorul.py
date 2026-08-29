"""Romanya Monitorul Prețurilor okuyucusunun saf fonksiyonları.

Fixture'lar GERÇEK canlı API'den alındı (2026-08-29) —
countries/romania/fixtures/.

Bu testlerin İKİNCİ bir işi var: kaynak BELGELENMEMİŞ bir iç uç nokta ve
SLA'sı yok; arayüz yenilenirse şema bir gecede değişebilir. Fixture'lar
beklenen yanıt biçimini SABİTLİYOR, böylece şema kayması sessiz sıfır ürün
yerine kırmızı bir test olarak görünür.
"""
import json
from pathlib import Path

import pytest

from countries.romania.scrapers.monitorul import (
    category_paths,
    dedupe_by_sku,
    leaf_category_ids,
    parse_products,
)

FIXTURES = Path(__file__).resolve().parents[1] / "countries" / "romania" / "fixtures"


def _load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


# ------------------------------------------------------------- kategori ağacı

def test_only_leaf_categories_are_returned():
    """Ara ve kök id'lerle sorgu atmak BOŞ liste döndürüyor; hepsini denemek
    kaynağa gereksiz yük ve koşu süresinin iki katı demek."""
    payload = _load("categories_sample.json")
    leaves = leaf_category_ids(payload)
    parents = {c.get("parentId") for c in payload["Items"]}
    assert leaves
    assert all(cid not in parents for cid in leaves)


def test_category_paths_are_full_breadcrumbs():
    paths = category_paths(_load("categories_sample.json"))
    assert paths
    # En az bir çok seviyeli yol olmalı — `prefix:` eşlemesi buna dayanıyor.
    assert any("/" in p for p in paths.values())


def test_category_path_walk_survives_a_cycle():
    """Bozuk bir ağaç (kendi kendine ya da döngüsel parentId) sonsuz döngüye
    girmemeli — koşuyu asmak, hatalı veriden daha kötü."""
    payload = {"Items": [
        {"id": "a", "name": "A", "parentId": "b"},
        {"id": "b", "name": "B", "parentId": "a"},
    ]}
    paths = category_paths(payload)
    assert set(paths) == {"a", "b"}


def test_empty_tree_yields_nothing():
    assert leaf_category_ids({}) == []
    assert category_paths({}) == {}


# ------------------------------------------------------------- ürün ayrıştırma

def test_products_are_parsed_from_live_shape():
    products = parse_products(_load("products_sample.json"), "LACTATE/LAPTE")
    assert products
    for p in products:
        assert p.name
        assert p.price > 0
        assert p.raw_category == "LACTATE/LAPTE"


def test_catprod_id_becomes_a_prefixed_merge_key():
    """Bu ülkede EAN YOK; devletin kanonik `catprod.id`'si barkodun işlevini
    görüyor. ÖNEK şart — kimse onu GTIN sanmasın."""
    products = parse_products(_load("products_sample.json"))
    assert products[0].merge_key.startswith("catprod:")
    assert products[0].barcode is None, "kaynak EAN vermiyor; uydurulmamalı"


def test_missing_catprod_yields_no_merge_key():
    """Kanonik kimlik yoksa UYDURMA — sahte bir anahtar, birleşmemiş ürünleri
    birleşmiş gibi gösterirdi."""
    payload = {"Items": [{"id": "1", "name": "Test 1L", "price": 5.0}]}
    (p,) = parse_products(payload)
    assert p.merge_key is None


def test_size_is_parsed_from_the_name():
    """API ayrı bir boyut alanı vermiyor; gramaj ürün adının içinde."""
    payload = {"Items": [
        {"id": "1", "name": "LAPTE ZUZU 1.5% 1L", "price": 7.49,
         "catprod": {"id": "9"}},
    ]}
    (p,) = parse_products(payload)
    assert (p.quantity, p.unit) == (1.0, "l")


@pytest.mark.parametrize("bad", [
    {"id": "1", "name": "", "price": 5.0},
    {"id": "2", "name": "Test", "price": 0},
    {"id": "3", "name": "Test", "price": None},
    {"id": "4", "name": "Test", "price": "n/a"},
])
def test_unusable_rows_are_skipped(bad):
    assert parse_products({"Items": [bad]}) == []


def test_brand_is_forwarded_when_present_and_none_otherwise():
    payload = {"Items": [
        {"id": "1", "name": "A 1L", "price": 1.0, "brand": "MANTOVA", "catprod": {"id": "1"}},
        {"id": "2", "name": "B 1L", "price": 1.0, "brand": "", "catprod": {"id": "2"}},
    ]}
    a, b = parse_products(payload)
    assert a.brand == "MANTOVA"
    assert b.brand is None


# --------------------------------------------------------------------- dedup

def test_same_product_in_two_categories_is_kept_once():
    """Aynı ürün birden çok kategoride görünebiliyor; iki kez göndermek aynı
    store_sku'ya iki fiyat satırı yazmaya çalışırdı."""
    payload = {"Items": [{"id": "77", "name": "X 1L", "price": 2.0, "catprod": {"id": "1"}}]}
    doubled = parse_products(payload) + parse_products(payload)
    assert len(dedupe_by_sku(doubled)) == 1


def test_dedupe_preserves_first_seen_order():
    payload = {"Items": [
        {"id": "1", "name": "A 1L", "price": 1.0, "catprod": {"id": "1"}},
        {"id": "2", "name": "B 1L", "price": 2.0, "catprod": {"id": "2"}},
    ]}
    products = parse_products(payload)
    assert [p.sku for p in dedupe_by_sku(products + products)] == ["1", "2"]
