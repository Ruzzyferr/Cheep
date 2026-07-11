"""Tests for the Żabka (Poland) Wolt "Żabka Jush" consumer-API scraper.

TDD for task 24: this replaces the old zabka.pl homepage-carousel approach
(see git history / the old test_zabka_parses_fixture in
test_pl_discounters.py, removed alongside this rewrite) with a full-catalog
crawl of Wolt's unauthenticated consumer-assortment API. All tests here are
pure/fixture-driven (parse_category_items/extract_next_page_token/
flatten_leaf_categories) or mock `requests.get` (fetch_products), matching
the no-network-in-tests pattern used by biedronka.py/auchan_pl.py's test
suites.
"""
import importlib.util
import sys
from decimal import Decimal
from pathlib import Path
from unittest import mock

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
PL_DIR = ROOT / "countries" / "poland"

from countries._common.category import assert_valid_products
from countries._common.fixture_harness import load_fixture, as_json

FIXTURES = PL_DIR / "fixtures"
_CATEGORY_FIXTURE = FIXTURES / "zabka_wolt_category_sample.json"
_TREE_FIXTURE = FIXTURES / "zabka_wolt_assortment_tree_sample.json"


def _load_pl_scraper_module(name: str):
    """Load countries/poland/scrapers/<name>.py by absolute file path (see
    test_pl_scrapers.py/test_pl_discounters.py for why: this country's own
    scraper directory is named `scrapers`, same as the repo-root package
    other tests import at module scope — loading by explicit file path
    sidesteps the sys.modules name collision entirely)."""
    path = PL_DIR / "scrapers" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"pl_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def zabka_mod():
    return _load_pl_scraper_module("zabka")


# ---- parse_category_items ---------------------------------------------


def test_zabka_wolt_parses_category_fixture(zabka_mod):
    ZabkaScraper = zabka_mod.ZabkaScraper
    raw = load_fixture(PL_DIR, _CATEGORY_FIXTURE.name)
    payload = as_json(raw)
    products = ZabkaScraper.parse_category_items(payload)

    assert_valid_products(products)
    assert len(products) == 11
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Żabka" for p in products)
    assert all(p.brand is None for p in products), "no structured brand field on this feed"
    # no raw_category override passed -> falls back to payload["category"]["name"]
    assert all(p.raw_category == "Mleko i zamienniki" for p in products)

    by_sku = {p.sku: p for p in products}

    milk = by_sku["44f289f4bcdfc41d57ea8bb4"]
    assert milk.price == Decimal("7.59"), "price is integer PLN CENTS -> Decimal zl"
    assert milk.barcode == "5901939002019"
    assert milk.quantity == 1.0 and milk.unit == "l"

    no_barcode = by_sku["ea72bf5a8b4dfc91c3fd8173"]
    assert no_barcode.barcode is None, "barcode_gtin: null must stay None, never guessed"
    assert no_barcode.price == Decimal("9.99")

    multipack = by_sku["snickers-2x75g-test-id"]
    # name says "2x 75 g" (total 150g); unit_info alone (just "75 g", the
    # single-bar size) would under-count it -- name-first parsing must win.
    assert multipack.quantity == 150.0 and multipack.unit == "g"
    assert multipack.unit_price == Decimal("43.27")

    discounted = by_sku["discounted-item-test-id"]
    assert discounted.price == Decimal("3.99")
    assert discounted.original_price == Decimal("4.99")

    alcohol = by_sku["2bc96d817e3233cbe862e6e5"]
    # parse_category_items does not itself filter alcohol -- that is done
    # downstream by config.json's category_deny_prefixes (see module
    # docstring) -- so the item is still parsed correctly here.
    assert alcohol.price == Decimal("52.99")
    assert alcohol.barcode == "6412709021271"


def test_zabka_wolt_parse_category_items_raw_category_override(zabka_mod):
    ZabkaScraper = zabka_mod.ZabkaScraper
    payload = as_json(load_fixture(PL_DIR, _CATEGORY_FIXTURE.name))
    products = ZabkaScraper.parse_category_items(payload, raw_category="Nabiał/Mleko i zamienniki")
    assert all(p.raw_category == "Nabiał/Mleko i zamienniki" for p in products)


@pytest.mark.parametrize("payload", [None, {}, {"items": []}, "not a dict", 42])
def test_zabka_wolt_parse_category_items_malformed_input_returns_empty(zabka_mod, payload):
    ZabkaScraper = zabka_mod.ZabkaScraper
    assert ZabkaScraper.parse_category_items(payload) == []


def test_zabka_wolt_parse_category_items_skips_items_with_no_price_or_id(zabka_mod):
    ZabkaScraper = zabka_mod.ZabkaScraper
    payload = {
        "category": {"name": "Test"},
        "items": [
            {"id": "1", "name": "Bez ceny"},                       # no price -> skip
            {"id": "2", "name": "Cena zero", "price": 0},           # price <= 0 -> skip
            {"name": "Bez id", "price": 100},                       # no id -> skip
            {"id": "3", "name": "", "price": 100},                  # empty name -> skip
            {"id": "4", "name": "OK produkt 1 l", "price": 100, "barcode_gtin": "1"},
        ],
    }
    products = ZabkaScraper.parse_category_items(payload)
    assert [p.sku for p in products] == ["4"]


# ---- extract_next_page_token -------------------------------------------


def test_zabka_wolt_extract_next_page_token_reads_fixture(zabka_mod):
    ZabkaScraper = zabka_mod.ZabkaScraper
    payload = as_json(load_fixture(PL_DIR, _CATEGORY_FIXTURE.name))
    assert ZabkaScraper.extract_next_page_token(payload) is None


def test_zabka_wolt_extract_next_page_token_returns_token_when_present(zabka_mod):
    ZabkaScraper = zabka_mod.ZabkaScraper
    payload = {"metadata": {"next_page_token": "eyJsYXN0X251bSI6IjMwMiJ9", "page": 1}}
    assert ZabkaScraper.extract_next_page_token(payload) == "eyJsYXN0X251bSI6IjMwMiJ9"


@pytest.mark.parametrize("payload", [None, {}, "not a dict", {"metadata": {}}])
def test_zabka_wolt_extract_next_page_token_defaults_on_malformed_input(zabka_mod, payload):
    ZabkaScraper = zabka_mod.ZabkaScraper
    assert ZabkaScraper.extract_next_page_token(payload) is None


# ---- flatten_leaf_categories --------------------------------------------


def test_zabka_wolt_flatten_leaf_categories_reads_tree_fixture(zabka_mod):
    ZabkaScraper = zabka_mod.ZabkaScraper
    tree = as_json(load_fixture(PL_DIR, _TREE_FIXTURE.name))
    leaves = ZabkaScraper.flatten_leaf_categories(tree)

    assert ("strefa-kibica-2", "Strefa kibica") in leaves, \
        "a top-level category with no subcategories is itself a leaf"
    assert ("napoje-gazowane-22", "Woda i napoje/Napoje gazowane") in leaves
    assert ("napoje-niegazowane-23", "Woda i napoje/Napoje niegazowane") in leaves
    assert ("kraftowe-32", "Piwa/Kraftowe") in leaves
    assert ("jasne-butelka-33", "Piwa/Jasne butelka") in leaves
    assert ("mleko-i-zamienniki-82", "Nabiał/Mleko i zamienniki") in leaves
    assert len(leaves) == 6
    # top-level categories that themselves have subcategories must NOT
    # appear as their own leaf entry
    assert not any(name in ("Woda i napoje", "Piwa", "Nabiał") for _, name in leaves)


@pytest.mark.parametrize("tree", [None, {}, "not a dict", {"categories": []}])
def test_zabka_wolt_flatten_leaf_categories_malformed_input_returns_empty(zabka_mod, tree):
    ZabkaScraper = zabka_mod.ZabkaScraper
    assert ZabkaScraper.flatten_leaf_categories(tree) == []


# ---- fetch_products (mocked requests.get) --------------------------------


def _item(item_id, name, price_cents, barcode=None):
    return {"id": item_id, "name": name, "price": price_cents, "barcode_gtin": barcode}


class _Resp:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


def test_zabka_wolt_fetch_products_paginates_dedupes_and_isolates_category_errors(zabka_mod):
    """fetch_products() against a mocked assortment tree + category
    endpoints (no real network) must: flatten the tree to leaf categories,
    follow `page_token` while `metadata.next_page_token` is non-null,
    dedupe by item id across categories, and continue past a category
    whose fetch raises."""
    mod = zabka_mod
    ZabkaScraper = mod.ZabkaScraper

    tree = {"categories": [{"name": "Test", "slug": "test-1", "subcategories": [
        {"name": "Broken", "slug": "cat-broken", "subcategories": []},
        {"name": "A", "slug": "cat-a", "subcategories": []},
        {"name": "B", "slug": "cat-b", "subcategories": []},
    ]}]}
    page1 = {
        "category": {"name": "A"},
        "items": [_item("1", "Produkt A 1 l", 350, "1"), _item("2", "Produkt B 500 g", 420, "2")],
        "metadata": {"next_page_token": "tok-2"},
    }
    page2 = {
        "category": {"name": "A"},
        "items": [_item("3", "Produkt C 200 g", 210, "3")],
        "metadata": {"next_page_token": None},
    }
    dup = {
        "category": {"name": "B"},
        "items": [_item("1", "Produkt A 1 l", 350, "1")],  # same id as cat-a page1 -> deduped
        "metadata": {"next_page_token": None},
    }

    def fake_get(url, headers=None, params=None, timeout=None):
        if url == f"{mod.ASSORTMENT_BASE}/venue-x/assortment":
            return _Resp(tree)
        if url == f"{mod.ASSORTMENT_BASE}/venue-x/assortment/categories/slug/cat-a":
            if params and params.get("page_token") == "tok-2":
                return _Resp(page2)
            return _Resp(page1)
        if url == f"{mod.ASSORTMENT_BASE}/venue-x/assortment/categories/slug/cat-b":
            return _Resp(dup)
        if url == f"{mod.ASSORTMENT_BASE}/venue-x/assortment/categories/slug/cat-broken":
            raise RuntimeError("simulated network failure")
        raise AssertionError(f"unexpected url {url}")

    scraper = ZabkaScraper()
    scraper.delay_between_requests = 0  # keep the test fast
    with mock.patch("requests.get", side_effect=fake_get):
        products = scraper.fetch_products(venue_slug="venue-x")

    skus = sorted(p.sku for p in products)
    assert skus == ["1", "2", "3"], "expected page-2 product + dedup across categories"
    assert len(products) == 3


def test_zabka_wolt_fetch_products_falls_back_to_venue_rediscovery(zabka_mod):
    """If the pinned venue slug's assortment tree fetch fails, fetch_products()
    must fall back to /v1/pages/venue-list/zabkajush-all to find a live
    venue slug and continue the crawl on it, rather than returning nothing."""
    mod = zabka_mod
    ZabkaScraper = mod.ZabkaScraper

    tree = {"categories": [{"name": "T", "slug": "t1", "subcategories": [
        {"name": "A", "slug": "cat-a", "subcategories": []},
    ]}]}
    venue_list = {"sections": [{"items": [{"venue": {"slug": "zabka-jush-alt"}}]}]}
    page = {"category": {"name": "A"}, "items": [_item("x1", "Produkt X 1 l", 500, "5900000000029")],
            "metadata": {"next_page_token": None}}

    def fake_get(url, headers=None, params=None, timeout=None):
        if url == f"{mod.ASSORTMENT_BASE}/zabka-jush-pinned/assortment":
            raise RuntimeError("simulated 404")
        if url == mod.VENUE_LIST_URL:
            return _Resp(venue_list)
        if url == f"{mod.ASSORTMENT_BASE}/zabka-jush-alt/assortment":
            return _Resp(tree)
        if url == f"{mod.ASSORTMENT_BASE}/zabka-jush-alt/assortment/categories/slug/cat-a":
            return _Resp(page)
        raise AssertionError(f"unexpected url {url}")

    scraper = ZabkaScraper()
    scraper.delay_between_requests = 0
    with mock.patch("requests.get", side_effect=fake_get):
        products = scraper.fetch_products(venue_slug="zabka-jush-pinned")

    assert len(products) == 1
    assert products[0].sku == "x1"


def test_zabka_wolt_fetch_products_returns_empty_when_no_venue_reachable(zabka_mod):
    """If BOTH the pinned venue AND re-discovery fail, fetch_products() must
    return an empty list rather than raising -- the run_all_countries
    pipeline treats an empty crawl as "no products this run", not a crash."""
    mod = zabka_mod
    ZabkaScraper = mod.ZabkaScraper

    def fake_get(url, headers=None, params=None, timeout=None):
        raise RuntimeError("simulated total outage")

    scraper = ZabkaScraper()
    scraper.delay_between_requests = 0
    with mock.patch("requests.get", side_effect=fake_get):
        products = scraper.fetch_products(venue_slug="zabka-jush-pinned")

    assert products == []
