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


def test_head_noun_decides_over_flavor():
    # the LAST keyword (head noun) wins, not the flavour modifier
    assert classify("Mis Çikolatalı Süt 200 ml")[0] == "Süt Ürünleri"
    assert classify("Ülker Sütlü Çikolata 80 G")[0] == "Atıştırmalık"
    assert classify("Eti Çilekli Gofret 35 G")[1] == "Gofret"
    assert classify("Kemal Kükrer Elma Sirkesi 500 ml")[1] == "Sirke"
    assert classify("Blendax Limon Özlü Şampuan 500 ml")[1] == "Şampuan"


def test_turkish_suffix_inflection():
    # pekmezi -> pekmez, reçeli -> reçel
    assert classify("Seyidoğlu Üzüm Pekmezi 700 G") == ("Kahvaltılık", "Tahin & Pekmez")
    assert classify("Tamek Çilek Reçeli 380 G") == ("Kahvaltılık", "Reçel")


def test_nonfood_form_word_beats_trailing_food_scent():
    # a soap/spray/cologne is never produce, even when a fruit/nut scent trails it
    assert classify("Ebru Sıvı Sabun Hindistan Cevizi 750 ml") == ("Kişisel Bakım & Kozmetik", "Sabun")
    assert top("Pereja Vücut Spreyi Portakal Çiçeği 200 ml") == "Kişisel Bakım & Kozmetik"
    assert top("Bestway Limon Desenli Deniz Yatak") == "Oyuncak & Hobi"
    assert classify("Blendax Limon Özlü Şampuan 500 ml") == ("Kişisel Bakım & Kozmetik", "Şampuan")
    # but a genuine food head noun still wins over a flavour modifier
    assert classify("Kemal Kükrer Elma Sirkesi 500 ml") == ("Temel Gıda", "Sirke")
    assert classify("Mis Çilekli Süt 200 ml") == ("Süt Ürünleri", "Süt")


def test_processed_food_not_produce():
    # processed/branded items must leave raw produce for their real category
    assert classify("7 Days Çilekli Kruvasan 60 G") == ("Fırın & Pastane", "Poğaça & Börek")
    assert classify("Nimet Elmalı Kurabiye 400 G") == ("Atıştırmalık", "Bisküvi")
    assert classify("Tat Domates Püresi 200 G") == ("Temel Gıda", "Konserve")
    assert classify("Migros Kabak Çekirdeği 200 G") == ("Atıştırmalık", "Kuruyemiş")
    assert top("Teekanne Şeftali Karışık Meyve Çayı 20'li") == "İçecek"
    assert classify("Ülker Pastil Ihlamur Limon Propolis 22 G") == ("Atıştırmalık", "Şekerleme")


def test_supplements_have_a_home():
    assert top("Bio Protein Muz Aromalı Protein Tozu 420 G") == "Sağlık & Takviye"
    assert top("Voop C Vitamini D3 Çinko Portakal Aromalı 20 Saşe") == "Sağlık & Takviye"


def test_nonfood_on_produce_substring():
    # words that merely CONTAIN a produce token must not become produce
    assert top("Wee Baby Klasik Cam Biberon 250 Ml") == "Bebek"          # biber-on
    assert top("Asya Lale İlkbahar Çiçek Soğanı") == "Ev & Yaşam"        # soğan
    assert top("Kiwi Pets Fare Şekilli Evcil Hayvan Oyuncağı") == "Pet Shop"
    assert top("Parmex Nar Çiçeği Aseton 125ml") == "Kişisel Bakım & Kozmetik"


def test_produce_lands_in_specific_sub_not_genel():
    # raw market category "Manav" must not flatten produce into "Genel"
    assert classify("Domates Kg", "Meyve Sebze") == ("Meyve & Sebze", "Sebze")
    assert classify("Elma Fuji Kg", "Manav") == ("Meyve & Sebze", "Meyve")
    assert classify("Mantar 300 g Paket", "Sebze") == ("Meyve & Sebze", "Sebze")
    assert classify("Yaban Mersini Paket 125 G", "Meyve") == ("Meyve & Sebze", "Meyve")


def test_corn_cereal_not_vegetable():
    # "Mısır Gevreği" (cornflakes) must be breakfast cereal, not Sebze via "mısır"
    assert classify("Nestle Mısır Gevreği 500 G") == ("Kahvaltılık", "Kahvaltılık Gevrek")
    assert classify("Taze Mısır Açık Adet")[0] == "Meyve & Sebze"


def test_unknown_falls_to_diger():
    assert top("Xyzzy Foobar 123") == "Diğer"
