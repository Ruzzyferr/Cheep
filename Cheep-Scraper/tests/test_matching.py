"""Tests for deterministic cross-market product matching."""
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scrapers.base_scraper import Product  # noqa: E402
from scrapers.matching import fingerprint, group_products  # noqa: E402


def P(name, store, qty, unit, price=10):
    return Product(name=name, price=Decimal(price), store=store, quantity=qty, unit=unit)


def _group_of(groups, prod):
    for g in groups:
        if prod in g:
            return g
    return []


def test_fingerprint_is_order_invariant():
    a = fingerprint("Pınar Süt %1 Yağlı 1 L", 1.0, "l")
    b = fingerprint("Pınar %1 Yağlı Süt 1 L", 1.0, "l")
    assert a == b


def test_same_product_across_markets_groups_together():
    mig = P("Pınar Süt %1 Yağlı 1 L", "Migros", 1.0, "l")
    sok = P("Pınar %1 Yağlı Süt 1 L", "ŞOK", 1.0, "l")
    p500 = P("Pınar Süt %1 Yağlı 500 ml", "Migros", 500.0, "ml")
    other = P("İçim Süt %3 Yağlı 1 L", "ŞOK", 1.0, "l")

    groups = group_products([mig, sok, p500, other])
    g = _group_of(groups, mig)
    assert sok in g            # same product, different market -> grouped
    assert p500 not in g       # different size -> different group
    assert other not in g      # different brand -> different group


def test_near_duplicate_extra_word_groups():
    a = P("Banvit Tavuk Göğüs Bonfile 1 kg", "Migros", 1.0, "kg")
    b = P("Banvit Tavuk Göğüs 1 kg", "ŞOK", 1.0, "kg")
    groups = group_products([a, b])
    assert b in _group_of(groups, a)


def test_distinct_products_stay_separate():
    a = P("Coca Cola 1 L", "Migros", 1.0, "l")
    b = P("Fanta Portakal 1 L", "ŞOK", 1.0, "l")
    groups = group_products([a, b])
    assert b not in _group_of(groups, a)


# --- gramaj must be flawless (user-reported failure scenarios) --------------
def test_different_volume_never_groups():
    one_l = P("Pınar Süt Tam Yağlı 1 L", "Migros", 1.0, "l")
    ml200 = P("Pınar Süt Tam Yağlı 200 ml", "ŞOK", 200.0, "ml")
    groups = group_products([one_l, ml200])
    assert ml200 not in _group_of(groups, one_l)


def test_different_mass_never_groups():
    big = P("Omo Toz Deterjan 5 kg", "Migros", 5.0, "kg")
    small = P("Omo Toz Deterjan 500 g", "ŞOK", 500.0, "g")
    groups = group_products([big, small])
    assert small not in _group_of(groups, big)


def test_equivalent_volume_unifies():
    # 1 L and 1000 ml are the same size -> should group
    a = P("Pınar Süt Tam Yağlı 1 L", "Migros", 1.0, "l")
    b = P("Pınar Süt Tam Yağlı 1000 ml", "ŞOK", 1000.0, "ml")
    groups = group_products([a, b])
    assert b in _group_of(groups, a)


def test_count_packs_of_different_size_separate():
    ten = P("Yumurta 10'lu", "Migros", 10.0, "adet")
    thirty = P("Yumurta 30'lu", "ŞOK", 30.0, "adet")
    groups = group_products([ten, thirty])
    assert thirty not in _group_of(groups, ten)


# --- brand- and variant-awareness (user-reported: never merge across brands) ---
def test_different_brands_never_merge():
    # a shopper picks a brand; Bahçıvan and Tarabya are NOT the same product
    bah = P("Bahçıvan Mozzarella Peyniri Rende 200 G", "Migros", 200.0, "g")
    tar = P("Tarabya Rende Mozzarella Peyniri 200 G", "A101", 200.0, "g")
    groups = group_products([bah, tar])
    assert tar not in _group_of(groups, bah)


def test_same_brand_same_size_still_merges_across_markets():
    a = P("Bahçıvan Mozzarella Peyniri Rende 200 G", "Migros", 200.0, "g")
    b = P("Bahçıvan Rende Mozzarella Peyniri 200 G", "A101", 200.0, "g")
    assert b in _group_of(group_products([a, b]), a)


def test_variant_words_block_merge():
    # lactose-free / light / kefir are different products from plain milk
    sut = P("İçim Süt 1 L", "Migros", 1.0, "l")
    lak = P("İçim Laktozsuz Süt 1 L", "ŞOK", 1.0, "l")
    light = P("İçim Light Süt 1 L", "A101", 1.0, "l")
    kefir = P("İçim Kefir 1 L", "Migros", 1.0, "l")
    groups = group_products([sut, lak, light, kefir])
    assert lak not in _group_of(groups, sut)
    assert light not in _group_of(groups, sut)
    assert kefir not in _group_of(groups, sut)


def test_noise_word_does_not_split_same_product():
    # "Rahat" is sub-brand noise, not a variant -> same product across markets
    a = P("İçim Rahat Laktozsuz Süt 1 L", "Migros", 1.0, "l")
    b = P("İçim Laktozsuz Süt 1 L", "A101", 1.0, "l")
    assert b in _group_of(group_products([a, b]), a)


def test_flavour_blocks_merge():
    cilek = P("Sek Çilekli Süt 200 ml", "Migros", 200.0, "ml")
    muz = P("Sek Muzlu Süt 200 ml", "ŞOK", 200.0, "ml")
    groups = group_products([cilek, muz])
    assert muz not in _group_of(groups, cilek)


def test_fat_percentage_separates_milk():
    # %1, %2.5 and %3 milk are different products and must never merge,
    # even though the brand and size are identical
    a = P("Pınar Süt %1 Yağlı 1 L", "Migros", 1.0, "l")
    b = P("Pınar Süt %2,5 Yağlı 1 L", "ŞOK", 1.0, "l")
    c = P("Pınar Süt %3 Yağlı 1 L", "A101", 1.0, "l")
    a2 = P("Pınar Süt %1 Yağlı 1 L", "A101", 1.0, "l")
    groups = group_products([a, b, c, a2])
    assert len(groups) == 3            # {%1 x2}, {%2.5}, {%3}
    assert a2 in _group_of(groups, a)  # same fat across markets still merges


def test_process_variant_separates():
    # barista / pastörize / UHT are distinct shelf products
    base = P("Alpro Bademli İçecek 1 L", "Migros", 1.0, "l")
    bar = P("Alpro Barista Bademli İçecek 1 L", "ŞOK", 1.0, "l")
    assert bar not in _group_of(group_products([base, bar]), base)


def test_multipack_not_merged_with_single():
    single = P("Coca-Cola Zero 1,5 L", "Migros", 1.5, "l")
    six = P("Coca-Cola Zero 1,5 L 6'lı", "A101", 1.5, "l")
    assert six not in _group_of(group_products([single, six]), single)


def test_different_appliance_models_separate():
    a = P("Sinbo SSM-2550 Tost Makinesi", "A101", 1.0, "adet")
    b = P("Sinbo SSM-2590 Izgara Tost Makinesi", "A101", 1.0, "adet")
    assert b not in _group_of(group_products([a, b]), a)


def test_model_number_disagreement_blocks_merge():
    # otherwise-identical names with different model codes are different products
    a = P("Piranha 7888 RGB Hoparlör", "A101", 1.0, "adet")
    b = P("Piranha 7890 RGB Hoparlör", "A101", 1.0, "adet")
    assert b not in _group_of(group_products([a, b]), a)


def test_counted_dimension_separates_products():
    # capsule / sheet / cm counts define distinct products even at same gross size
    f20 = P("Finish Quantum 20 Kapsül Bulaşık Tableti", "A101", 1.0, "adet")
    f40 = P("Finish Quantum 40 Kapsül Bulaşık Tableti", "A101", 1.0, "adet")
    assert f40 not in _group_of(group_products([f20, f40]), f20)
    n400 = P("Noki Not Kağıdı 400 Yaprak 75x75 mm", "X", 1.0, "adet")
    n100 = P("Noki Not Kağıdı 100 Yaprak 75x75 mm", "X", 1.0, "adet")
    assert n100 not in _group_of(group_products([n400, n100]), n400)
    t26 = P("Hascevher Tava 26 cm", "A101", 1.0, "adet")
    t20 = P("Hascevher Wok Tava 20 cm", "A101", 1.0, "adet")
    assert t20 not in _group_of(group_products([t26, t20]), t26)
