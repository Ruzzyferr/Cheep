"""Tests for deterministic cross-market product matching."""
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scrapers.base_scraper import Product  # noqa: E402
from scrapers.matching import fingerprint, group_products, brand_key  # noqa: E402


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


def test_extra_descriptor_word_blocks_merge():
    # STRICT identity: an extra real descriptor = a different product. "Tavuk Göğüs
    # Bonfile" (a specific cut) is not the same shelf item as plain "Tavuk Göğüs".
    a = P("Banvit Tavuk Göğüs Bonfile 1 kg", "Migros", 1.0, "kg")
    b = P("Banvit Tavuk Göğüs 1 kg", "ŞOK", 1.0, "kg")
    groups = group_products([a, b])
    assert b not in _group_of(groups, a)


def test_identical_name_merges_despite_word_order_and_bilingual_noise():
    # same product, different market naming (word order + "MEN" bilingual dupe) -> merge
    mig = P("NIVEA MEN Erkek Pump Sprey Deodorant Fresh Active 75 Ml", "Migros", 75.0, "ml")
    car = P("Nivea Fresh Active Pump Sprey Deodorant Erkek 75 ml", "CarrefourSA", 75.0, "ml")
    assert car in _group_of(group_products([mig, car]), mig)


def test_version_and_gender_variants_stay_separate():
    # the exact live-QA failure: Active vs Natural, Erkek vs Kadın are NOT one product
    active = P("Nivea Fresh Active Erkek Deo Sprey 75 ml", "A101", 75.0, "ml")
    natural = P("Nivea Fresh Natural Erkek Deo Sprey 75 ml", "Migros", 75.0, "ml")
    kadin = P("Nivea Fresh Active Kadın Deo Sprey 75 ml", "ŞOK", 75.0, "ml")
    groups = group_products([active, natural, kadin])
    assert natural not in _group_of(groups, active)   # Active ≠ Natural
    assert kadin not in _group_of(groups, active)      # Erkek ≠ Kadın


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


def test_product_subtype_words_block_merge():
    # live-QA regressions: different shelf products were merging into fake "deals"
    # because the distinguishing word wasn't a discriminator.
    plain = P("Sensodyne Diş Macunu 75 ml", "A101", 75.0, "ml", price=75)
    white = P("Sensodyne Whitening Diş Macunu 75 Ml", "Migros", 75.0, "ml", price=224)
    assert white not in _group_of(group_products([plain, white]), plain)

    sosis = P("Namet Hindi Sosis 7/24 140 G", "Migros", 140.0, "g", price=87)
    kokteyl = P("Namet 7/24 Hindi Kokteyl Sosis 140 G", "A101", 140.0, "g", price=17)
    assert kokteyl not in _group_of(group_products([sosis, kokteyl]), sosis)

    erkek = P("Nivea Fresh Active Erkek Deo Sprey 75 ml", "A101", 75.0, "ml")
    kadin = P("Nivea Deodorant Fresh Active Kadın 75 ml", "ŞOK", 75.0, "ml")
    assert kadin not in _group_of(group_products([erkek, kadin]), erkek)


# --- brand key derivation for produce / unbranded (finding #2) --------------
def test_scraped_brand_still_wins():
    p = P("Mozzarella Peyniri 200 G", "Migros", 200.0, "g")
    p.brand = "Bahçıvan"
    assert brand_key(p) == "bahcivan"


def test_unbranded_falls_back_to_first_name_token():
    # No scraped brand -> the first significant name token (conventionally the brand
    # in TR market names) is used, so a brand-less market still buckets with markets
    # that DID record the brand.
    p = P("Pınar Süt 1 L", "ŞOK", 1.0, "l")  # ŞOK leaves .brand empty
    assert brand_key(p) == "pinar"


def test_brandless_market_still_matches_branded_market():
    # REGRESSION GUARD: ŞOK does not populate `brand`, but the same item from Migros
    # does. They must still group together (this is the core cross-market purpose).
    sok = P("Pınar Süt 1 L", "ŞOK", 1.0, "l")          # .brand == None
    migros = P("Pınar Süt 1 L", "Migros", 1.0, "l")
    migros.brand = "Pınar"
    assert sok in _group_of(group_products([sok, migros]), migros)


def test_different_grade_produce_stays_separate():
    # Both fall back to the "elma" brand key, but different significant tokens
    # (kirmizi vs yesil) keep them apart under strict token-equality — no false merge.
    red = P("Kırmızı Elma", "Migros", 1.0, "kg")
    green = P("Yeşil Elma", "ŞOK", 1.0, "kg")
    groups = group_products([red, green])
    assert green not in _group_of(groups, red)


def test_same_unbranded_produce_across_markets_still_merges():
    a = P("Yeşil Elma", "Migros", 1.0, "kg")
    b = P("Yeşil Elma", "ŞOK", 1.0, "kg")
    assert b in _group_of(group_products([a, b]), a)


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
