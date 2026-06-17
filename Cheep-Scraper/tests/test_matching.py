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
