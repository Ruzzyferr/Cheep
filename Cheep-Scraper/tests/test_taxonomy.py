"""Tests for the canonical, name-first product classifier."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from util.taxonomy import classify, CANONICAL_TAXONOMY  # noqa: E402


def top(name, raw=None):
    return classify(name, raw)[0]


def sub(name, raw=None):
    return classify(name, raw)[1]


def test_taxonomy_structure():
    # every subcategory maps back to exactly one top
    assert "Süt Ürünleri" in CANONICAL_TAXONOMY
    assert "Süt" in CANONICAL_TAXONOMY["Süt Ürünleri"]


def test_milk_consistent_across_brands_and_markets():
    assert classify("Pınar Süt %1 Yağlı 1 L") == ("Süt Ürünleri", "Süt")
    assert classify("Mis Uht Süt %3.1 Yağlı 1 L") == ("Süt Ürünleri", "Süt")
    assert classify("İçim Süt %3 Yağlı 1 L") == ("Süt Ürünleri", "Süt")


def test_dairy_subcategories():
    assert classify("Sek Kaşar Peyniri 400 g") == ("Süt Ürünleri", "Peynir")
    assert classify("Pınar Yoğurt Tam Yağlı 1 kg") == ("Süt Ürünleri", "Yoğurt")
    assert classify("Sütaş Tereyağı 250 g") == ("Süt Ürünleri", "Tereyağı")


def test_fish_is_not_honey():
    # "balığı" must NOT match honey "bal"
    assert top("Pınar Ton Balığı 160 g") == "Et, Tavuk & Balık"
    assert sub("Pınar Ton Balığı 160 g") == "Balık"
    assert classify("Balparmak Çiçek Balı 850 g") == ("Kahvaltılık", "Bal")


def test_cola_is_drink_not_chocolate():
    assert top("Coca Cola 1 L") == "İçecek"
    assert top("Pepsi Kola 2.5 L") == "İçecek"
    assert classify("Ülker Çikolatalı Gofret 35 g")[0] == "Atıştırmalık"


def test_meat_and_produce():
    assert top("Banvit Tavuk Göğüs 1 kg") == "Et, Tavuk & Balık"
    assert classify("Domates kg") == ("Meyve & Sebze", "Sebze")
    assert classify("Muz kg") == ("Meyve & Sebze", "Meyve")


def test_cleaning_and_paper():
    assert top("Domestos Çamaşır Suyu 750 ml") == "Temizlik"
    assert classify("Selpak Tuvalet Kağıdı 32'li") == ("Kağıt & Hijyen", "Tuvalet Kağıdı")
    assert top("Fairy Bulaşık Deterjanı 650 ml") == "Temizlik"


def test_baby_and_pet():
    assert classify("Prima Bebek Bezi 5 Numara") == ("Bebek", "Bebek Bezi")
    assert classify("Whiskas Kedi Maması 1.2 kg") == ("Pet Shop", "Kedi Maması")


def test_breakfast_and_staples():
    assert classify("Yumurta 10'lu") == ("Kahvaltılık", "Yumurta")
    assert top("Lipton Demlik Poşet Çay 100'lü") == "İçecek"
    assert top("Yayla Kırmızı Mercimek 1 kg") == "Temel Gıda"


def test_unknown_falls_to_diger():
    assert top("Xyzzy Foobar 123") == "Diğer"
