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
