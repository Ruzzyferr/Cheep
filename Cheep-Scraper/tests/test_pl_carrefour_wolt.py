"""Tests for the Carrefour (Poland) Wolt hypermarket consumer-API scraper.

TDD for task 24: Carrefour's direct site was Cloudflare-WAF blocked, so it now
sources from Wolt (same `WoltVenueScraper` base + endpoint model as Żabka Jush).
All tests here are pure/fixture-driven (parse_category_items /
extract_next_page_token / flatten_leaf_categories) or mock `requests.get`
(fetch_products), matching the no-network-in-tests pattern used by the other PL
scraper suites. The pinned venue is a full hypermarket ("Carrefour
Jerozolimskie"), not a small Express dark store.
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
_CATEGORY_FIXTURE = FIXTURES / "carrefour_wolt_category_sample.json"
_TREE_FIXTURE = FIXTURES / "carrefour_wolt_assortment_tree_sample.json"


def _load_pl_scraper_module(name: str):
    """Load countries/poland/scrapers/<name>.py by absolute file path (see
    test_pl_zabka_wolt.py for why: the country's own `scrapers` dir collides
    with the repo-root package name)."""
    path = PL_DIR / "scrapers" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"pl_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def carrefour_mod():
    return _load_pl_scraper_module("carrefour_pl")


# ---- parse_category_items ---------------------------------------------


def test_carrefour_wolt_parses_category_fixture(carrefour_mod):
    Scraper = carrefour_mod.CarrefourPLScraper
    payload = as_json(load_fixture(PL_DIR, _CATEGORY_FIXTURE.name))
    products = Scraper.parse_category_items(payload)

    assert_valid_products(products)
    assert len(products) == 12
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Carrefour" for p in products)
    assert all(p.brand is None for p in products), "no structured brand field on this feed"
    # no raw_category override -> falls back to payload["category"]["name"]
    assert all(p.raw_category == "Sery żółte" for p in products)

    by_sku = {p.sku: p for p in products}

    salami = by_sku["1a48b1667d817727c8bd018d"]
    assert salami.price == Decimal("6.00"), "price is integer PLN CENTS -> Decimal zl"
    assert salami.barcode == "5905784329147"
    assert salami.quantity == 150.0 and salami.unit == "g"
    assert salami.unit_price == Decimal("40.00") and salami.unit_price_unit == "kg"

    # size only in the NAME (unit_info is null) must still be parsed
    edamski = by_sku["9aab8651d837f422757dcc2c"]
    assert edamski.quantity == 1.0 and edamski.unit == "kg"
    assert edamski.unit_price == Decimal("23.89")

    no_barcode = by_sku["carrefour-nobarcode-test-id"]
    assert no_barcode.barcode is None, "barcode_gtin: null must stay None, never guessed"
    assert no_barcode.price == Decimal("5.55")

    multipack = by_sku["carrefour-multipack-test-id"]
    # name says "2x 150 g" (total 300 g); unit_info alone ("150 g") under-counts
    # it -- name-first parsing must win.
    assert multipack.quantity == 300.0 and multipack.unit == "g"
    assert multipack.unit_price == Decimal("26.63")

    discounted = by_sku["carrefour-discounted-test-id"]
    assert discounted.price == Decimal("4.99")
    assert discounted.original_price == Decimal("6.49")

    wine = by_sku["carrefour-wine-test-id"]
    # parse_category_items does not itself filter alcohol -- item still parsed.
    assert wine.price == Decimal("29.99")
    assert wine.barcode == "5900000000043"


def test_carrefour_wolt_parse_category_items_raw_category_override(carrefour_mod):
    Scraper = carrefour_mod.CarrefourPLScraper
    payload = as_json(load_fixture(PL_DIR, _CATEGORY_FIXTURE.name))
    products = Scraper.parse_category_items(payload, raw_category="Nabiał/Sery żółte")
    assert all(p.raw_category == "Nabiał/Sery żółte" for p in products)


@pytest.mark.parametrize("payload", [None, {}, {"items": []}, "not a dict", 42])
def test_carrefour_wolt_parse_category_items_malformed_input_returns_empty(carrefour_mod, payload):
    Scraper = carrefour_mod.CarrefourPLScraper
    assert Scraper.parse_category_items(payload) == []


def test_carrefour_wolt_parse_category_items_skips_items_with_no_price_or_id(carrefour_mod):
    Scraper = carrefour_mod.CarrefourPLScraper
    payload = {
        "category": {"name": "Test"},
        "items": [
            {"id": "1", "name": "Bez ceny"},
            {"id": "2", "name": "Cena zero", "price": 0},
            {"name": "Bez id", "price": 100},
            {"id": "3", "name": "", "price": 100},
            {"id": "4", "name": "OK produkt 1 l", "price": 100, "barcode_gtin": "1"},
        ],
    }
    products = Scraper.parse_category_items(payload)
    assert [p.sku for p in products] == ["4"]


# ---- extract_next_page_token -------------------------------------------


def test_carrefour_wolt_extract_next_page_token_reads_fixture(carrefour_mod):
    Scraper = carrefour_mod.CarrefourPLScraper
    payload = as_json(load_fixture(PL_DIR, _CATEGORY_FIXTURE.name))
    assert Scraper.extract_next_page_token(payload) is None


def test_carrefour_wolt_extract_next_page_token_returns_token_when_present(carrefour_mod):
    Scraper = carrefour_mod.CarrefourPLScraper
    # real token captured live from the "Sery żółte" category page 1.
    payload = {"metadata": {"next_page_token": "eyJsYXN0X251bSI6IjE2NCIsInBhZ2UiOjJ9", "page": 1}}
    assert Scraper.extract_next_page_token(payload) == "eyJsYXN0X251bSI6IjE2NCIsInBhZ2UiOjJ9"


@pytest.mark.parametrize("payload", [None, {}, "not a dict", {"metadata": {}}])
def test_carrefour_wolt_extract_next_page_token_defaults_on_malformed_input(carrefour_mod, payload):
    Scraper = carrefour_mod.CarrefourPLScraper
    assert Scraper.extract_next_page_token(payload) is None


# ---- flatten_leaf_categories --------------------------------------------


def test_carrefour_wolt_flatten_leaf_categories_reads_tree_fixture(carrefour_mod):
    Scraper = carrefour_mod.CarrefourPLScraper
    tree = as_json(load_fixture(PL_DIR, _TREE_FIXTURE.name))
    leaves = Scraper.flatten_leaf_categories(tree)

    assert ("produkty-tygodnia-11", "Produkty tygodnia") in leaves, \
        "a top-level category with no subcategories is itself a leaf"
    assert ("owoce-32", "Owoce i warzywa/Owoce") in leaves
    assert ("warzywa-33", "Owoce i warzywa/Warzywa") in leaves
    assert ("sery-zolte-49", "Nabiał/Sery żółte") in leaves
    assert ("twarogi-50", "Nabiał/Twarogi") in leaves
    assert len(leaves) == 5
    assert not any(name in ("Owoce i warzywa", "Nabiał") for _, name in leaves)


@pytest.mark.parametrize("tree", [None, {}, "not a dict", {"categories": []}])
def test_carrefour_wolt_flatten_leaf_categories_malformed_input_returns_empty(carrefour_mod, tree):
    Scraper = carrefour_mod.CarrefourPLScraper
    assert Scraper.flatten_leaf_categories(tree) == []


# ---- scraper instantiation ----------------------------------------------


def test_carrefour_scraper_instantiates_and_exposes_fetch_products(carrefour_mod):
    Scraper = carrefour_mod.CarrefourPLScraper
    scraper = Scraper()
    assert scraper.store_name == "Carrefour"
    assert callable(scraper.fetch_products)
    assert scraper.venue_slug == "carrefour-jerozolimskie"
    assert carrefour_mod.VENUE_LIST_URL.endswith("/carrefour-all")


# ---- extract_venue_ids_from_search (venue-discovery via search) ----------


def test_carrefour_wolt_extract_venue_ids_from_search(carrefour_mod):
    Scraper = carrefour_mod.CarrefourPLScraper
    # shape mirrors a real POST /v1/pages/search response: venue tiles carry
    # link.type == "venue-id" with the id in link.target.
    payload = {"sections": [{"items": [
        {"title": "Carrefour Jerozolimskie",
         "link": {"type": "venue-id", "target": "6627bfe3021a4b3c93ca22ea"}},
        {"title": "A banner", "link": {"type": "venue-page", "target": "carrefour-all:warsaw"}},
        {"title": "Carrefour Złota",
         "link": {"type": "venue-id", "target": "abc123"}},
    ]}]}
    assert Scraper.extract_venue_ids_from_search(payload) == \
        ["6627bfe3021a4b3c93ca22ea", "abc123"]


@pytest.mark.parametrize("payload", [None, {}, "x", 5, {"sections": []}])
def test_carrefour_wolt_extract_venue_ids_from_search_malformed(carrefour_mod, payload):
    Scraper = carrefour_mod.CarrefourPLScraper
    assert Scraper.extract_venue_ids_from_search(payload) == []


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


def test_carrefour_wolt_fetch_products_paginates_dedupes_and_isolates_errors(carrefour_mod):
    mod = carrefour_mod
    Scraper = mod.CarrefourPLScraper

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
        "items": [_item("1", "Produkt A 1 l", 350, "1")],
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

    scraper = Scraper()
    scraper.delay_between_requests = 0
    with mock.patch("requests.get", side_effect=fake_get):
        products = scraper.fetch_products(venue_slug="venue-x")

    assert sorted(p.sku for p in products) == ["1", "2", "3"]
    assert all(p.store == "Carrefour" for p in products)


def test_carrefour_wolt_fetch_products_falls_back_to_venue_rediscovery(carrefour_mod):
    mod = carrefour_mod
    Scraper = mod.CarrefourPLScraper

    tree = {"categories": [{"name": "T", "slug": "t1", "subcategories": [
        {"name": "A", "slug": "cat-a", "subcategories": []},
    ]}]}
    venue_list = {"sections": [{"items": [{"venue": {"slug": "carrefour-alt"}}]}]}
    page = {"category": {"name": "A"}, "items": [_item("x1", "Produkt X 1 l", 500, "5900000000029")],
            "metadata": {"next_page_token": None}}

    def fake_get(url, headers=None, params=None, timeout=None):
        if url == f"{mod.ASSORTMENT_BASE}/carrefour-pinned/assortment":
            raise RuntimeError("simulated 404")
        if url == mod.VENUE_LIST_URL:
            return _Resp(venue_list)
        if url == f"{mod.ASSORTMENT_BASE}/carrefour-alt/assortment":
            return _Resp(tree)
        if url == f"{mod.ASSORTMENT_BASE}/carrefour-alt/assortment/categories/slug/cat-a":
            return _Resp(page)
        raise AssertionError(f"unexpected url {url}")

    scraper = Scraper()
    scraper.delay_between_requests = 0
    with mock.patch("requests.get", side_effect=fake_get):
        products = scraper.fetch_products(venue_slug="carrefour-pinned")

    assert len(products) == 1 and products[0].sku == "x1"


def test_carrefour_wolt_fetch_products_returns_empty_when_no_venue_reachable(carrefour_mod):
    mod = carrefour_mod
    Scraper = mod.CarrefourPLScraper

    def fake_get(url, headers=None, params=None, timeout=None):
        raise RuntimeError("simulated total outage")

    scraper = Scraper()
    scraper.delay_between_requests = 0
    with mock.patch("requests.get", side_effect=fake_get):
        products = scraper.fetch_products(venue_slug="carrefour-pinned")

    assert products == []
