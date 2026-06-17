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
    assert classify("Migros Mısır Nişastası 250 G") == ("Temel Gıda", "Un")
    assert top("Çerezza Patlamış Mısır 100 G") == "Atıştırmalık"


def test_candy_is_not_cooking_sugar():
    # "Şeker" sub is cooking sugar only; confectionery -> Atıştırmalık/Şekerleme
    assert classify("Haribo Altın Ayıcık 175 G") == ("Atıştırmalık", "Şekerleme")
    assert classify("Uzungil Nane Aromalı Akide Şekeri 180 G") == ("Atıştırmalık", "Şekerleme")
    assert classify("Ülker Yupo Metre Çilek Aromalı 50 G") == ("Atıştırmalık", "Şekerleme")
    # real cooking sugar stays
    assert classify("Balküpü Toz Şeker 1 Kg") == ("Temel Gıda", "Şeker")


def test_ice_cream_brand_beats_flavour():
    # frozen brand/type words win over a chocolate/nut flavour, wherever they sit
    assert top("Carte d'Or Bitter Beyaz İsviçre Çikolatası 850 Ml") == "Dondurma"
    assert top("Algida Magnum Badem 100 ml") == "Dondurma"
    assert top("Algida Keyif Kakao Vanilya 750 ml") == "Dondurma"
    assert top("Eti Alaska Frigo Sütlü 60 ml") == "Dondurma"


def test_baby_products_win_over_adult_lookalikes():
    assert top("Sebamed Bebek Şampuanı 500 Ml") == "Bebek"
    assert top("Dalin Bıcı Bıcı Kolonya 150 Ml") == "Bebek"
    assert top("Hipp Babysanft Güneş Kremi SPF 50+ 200 ml") == "Bebek"
    assert top("Aptamil 1 Bebek Sütü 400 G") == "Bebek"
    assert top("Eti Cicibebe Bebe Bisküvisi 172 G") == "Bebek"
    # a normal adult shampoo is unaffected
    assert classify("Elidor Şampuan Bukle Belirginleştirici 500 ml")[0] == "Kişisel Bakım & Kozmetik"


def test_packaging_word_does_not_beat_food_head_noun():
    # a cup/bowl/pan word leading the name must not steal the food
    assert classify("İçim Bardak Ayran 200 Ml") == ("Süt Ürünleri", "Ayran")
    assert classify("Becel Klasik Kase Margarin 250 G")[0] == "Süt Ürünleri"
    assert classify("Sütaş Tava Yoğurt 1000 G") == ("Süt Ürünleri", "Yoğurt")
    assert classify("Uno Karadeniz Tava Ekmeği 470 G") == ("Fırın & Pastane", "Ekmek")
    assert top("Knorr Çabuk Arabiata Bardak Makarna 48 G") == "Temel Gıda"
    assert top("Lipton Yellow Bardak Poşet Çay 100'lü") == "İçecek"
    # but a genuine glass/appliance with the food word as a modifier stays homeware/electronics
    assert classify("Lav Lara Su Bardağı 6'lı 205 Cc")[0] == "Ev & Yaşam"
    assert top("Arzum Okka Türk Kahvesi Makinesi") == "Elektronik"


def test_spreads_go_to_breakfast_not_nuts_or_chocolate():
    assert classify("Ülker Çokokrem 400 Gr") == ("Kahvaltılık", "Tahin & Pekmez")
    assert classify("Nutella 750 G") == ("Kahvaltılık", "Tahin & Pekmez")
    assert classify("Fellas %100 Fıstık Ezmesi 350 G") == ("Kahvaltılık", "Tahin & Pekmez")
    assert classify("Torku Frema Kakaolu Fındıklı Krema 400 G") == ("Kahvaltılık", "Tahin & Pekmez")


def test_snack_brand_beats_dairy_meat_flavour():
    assert top("Doritos Nacho Peynirli 135 g") == "Atıştırmalık"
    assert top("Lay's Yoğurt & Mevsim Yeşillikleri 125 G") == "Atıştırmalık"
    assert top("Ülker Çizi Çıtır Peynir & Soğan 120 g") == "Atıştırmalık"


def test_pet_food_not_human_meat_or_fish():
    assert top("Gourmet Gold Ton Balıklı 85 Gr") == "Pet Shop"
    assert top("Friskies Somonlu Yaş Mama 85 G") == "Pet Shop"
    assert top("Pedigree Biftekli Köpek Maması 2.2 Kg") == "Pet Shop"


def test_bouillon_and_broth_are_pantry_not_juice():
    assert top("Knorr Tavuk Suyu Bulyon 24'lü") == "Temel Gıda"
    assert top("Fide İlikli Kemik Suyu 480 Ml") == "Temel Gıda"


def test_kakao_krema_do_not_swallow_finished_products():
    # cocoa/cream MODIFIER words must not pull finished snacks into baking/dairy
    assert classify("Ülker Biskrem Kakaolu 200 G") == ("Atıştırmalık", "Bisküvi")
    assert top("Ülker Bitter Kare Çikolata %80 Kakaolu 60 G") == "Atıştırmalık"
    assert top("Eti Petit Beurre Kakao Kremalı 270 g") == "Atıştırmalık"
    assert top("Balocco Wafers Kakaolu 250 G") == "Atıştırmalık"
    # genuine baking cocoa / chips stay
    assert classify("Dr.Oetker Kakao 50 G") == ("Temel Gıda", "Pasta Malzemeleri")
    assert classify("Pakmaya Sütlü Parça Çikolata 70 G") == ("Temel Gıda", "Pasta Malzemeleri")


def test_tablet_word_is_not_electronics():
    assert top("Finish Quantum 50 Tablet Bulaşık Makinesi") == "Temizlik"
    assert top("Milka Sütlü Çikolata Tablet 80 G") == "Atıştırmalık"


def test_blueberry_cookies_is_a_biscuit_not_produce():
    assert classify("Original Gourmet Blueberry Cookies 180 G") == ("Atıştırmalık", "Bisküvi")
    assert classify("Adalılar Tanem Soslu Mısır 120 G")[0] == "Atıştırmalık"


def test_unknown_falls_to_diger():
    assert top("Xyzzy Foobar 123") == "Diğer"
