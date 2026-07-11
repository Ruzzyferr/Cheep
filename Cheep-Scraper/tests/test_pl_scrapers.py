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
from countries._common.fixture_harness import load_fixture

FIXTURES = PL_DIR / "fixtures"


def _load_pl_scraper_module(name: str):
    """Load countries/poland/scrapers/<name>.py by absolute file path.

    Deliberately NOT `sys.path.insert(0, PL_DIR); from scrapers.<name> import
    ...`: this country's own scraper directory is named `scrapers`, same as
    the repo-root package that other tests in this suite (test_matching.py,
    test_unit_parser.py) import at module scope. Whichever one wins the bare
    name `scrapers` in `sys.modules` first stays cached for the rest of the
    pytest session — a name-based import here is collection-order-dependent
    and, tried the naive way, either fails itself or breaks those other
    tests' `from scrapers.units import ...`. Loading by explicit file path
    sidesteps the collision entirely; it never touches `sys.modules["scrapers"]`.
    """
    path = PL_DIR / "scrapers" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"pl_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _first_fixture(*names):
    for name in names:
        p = FIXTURES / name
        if p.exists():
            return p
    return None


_CARREFOUR_FIXTURE = _first_fixture("carrefour_pl_sample.json", "carrefour_pl_sample.html")
_AUCHAN_FIXTURE = _first_fixture("auchan_pl_sample.json", "auchan_pl_sample.html")
_AUCHAN_V6_FIXTURE = _first_fixture("auchan_pl_v6_sample.json")
_AUCHAN_CATEGORIES_FIXTURE = _first_fixture("auchan_pl_categories_sample.json")


@pytest.mark.skipif(_CARREFOUR_FIXTURE is None,
                    reason="no Carrefour PL fixture (site unreachable at build time)")
def test_carrefour_pl_parses_fixture():
    CarrefourPLScraper = _load_pl_scraper_module("carrefour_pl").CarrefourPLScraper
    raw = load_fixture(PL_DIR, _CARREFOUR_FIXTURE.name)
    products = CarrefourPLScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Carrefour" for p in products)


@pytest.mark.skipif(_AUCHAN_FIXTURE is None,
                    reason="no Auchan PL fixture (site unreachable at build time)")
def test_auchan_pl_parses_fixture():
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    raw = load_fixture(PL_DIR, _AUCHAN_FIXTURE.name)
    products = AuchanPLScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Auchan" for p in products)


@pytest.mark.skipif(_AUCHAN_V6_FIXTURE is None,
                    reason="no Auchan PL v6 fixture (site unreachable at build time)")
def test_auchan_pl_parses_v6_fixture():
    """`v6/product-pages` catalogue-crawl parsing: 3 real captured items
    (1 on_offer CATCHWEIGHT with an active promo, 1 REGULAR with no
    packSizeDescription at all, 1 CATCHWEIGHT with no promo) — same field
    shape as the v5 endpoint's nested `product` object, just flat."""
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    raw = load_fixture(PL_DIR, _AUCHAN_V6_FIXTURE.name)
    products = AuchanPLScraper.parse_v6(raw)
    assert_valid_products(products)
    assert len(products) == 3
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Auchan" for p in products)
    assert all(p.barcode is None for p in products)

    by_sku = {p.sku: p for p in products}

    peaches = by_sku["00142167"]
    assert peaches.price == Decimal("2.98"), "promoPrice must win over price"
    assert peaches.original_price == Decimal("4.50")
    assert peaches.quantity == 0.5 and peaches.unit == "kg", "catchweight.typicalQuantity, not packSizeDescription"
    assert peaches.raw_category == "Artykuły spożywcze/Owoce, warzywa i zioła/Owoce/Brzoskwinie", \
        "raw_category is the FULL '/'-joined categoryPath breadcrumb (task 20), not just the deepest segment"

    kiwi = by_sku["00034052"]
    assert kiwi.price == Decimal("1.98")
    assert kiwi.original_price is None
    assert kiwi.quantity == 1.0 and kiwi.unit == "adet", "no packSizeDescription -> parser default"
    assert kiwi.raw_category == "Artykuły spożywcze/Owoce, warzywa i zioła/Owoce/Kiwi"

    banany = by_sku["00034041"]
    assert banany.price == Decimal("6.98")
    assert banany.original_price is None
    assert banany.quantity == 1.0 and banany.unit == "kg"
    assert banany.raw_category == "Artykuły spożywcze/Owoce, warzywa i zioła/Owoce/Banany"


def test_auchan_pl_parse_v6_dedupes_within_response():
    """A product id repeated across groups (e.g. on_offer + ungrouped) in
    the SAME response must only be emitted once (first occurrence wins)."""
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    item = {
        "productId": "p1", "retailerProductId": "sku1", "type": "REGULAR",
        "name": "Produkt testowy", "brand": "TestBrand",
        "price": {"amount": "3.50", "currency": "PLN"},
        "categoryPath": ["Dział", "Kategoria", "Produkt testowy"],
    }
    raw = __import__("json").dumps({
        "productGroups": [
            {"type": "on_offer", "decoratedProducts": [item]},
            {"type": "ungrouped", "decoratedProducts": [item]},
        ],
        "metadata": {},
    })
    products = AuchanPLScraper.parse_v6(raw)
    assert len(products) == 1


def test_auchan_pl_build_product_raw_category_is_full_joined_breadcrumb():
    """Task 20: raw_category must be the FULL categoryPath breadcrumb,
    '/'-joined, not just the deepest segment — this is what lets
    config.json's category_deny_prefixes / category_map.json's "prefix:"
    keys work for Auchan (a single leaf name is legitimately reused across
    different departments, e.g. "Pieczenie" = deli pate under 'Artykuły
    spożywcze' OR bakeware under 'Artykuły dla domu' — only the full
    breadcrumb disambiguates which one a given product is)."""
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    item = {
        "productId": "p1", "retailerProductId": "sku1", "name": "Deli pate",
        "price": {"amount": "5.00", "currency": "PLN"},
        "categoryPath": ["Artykuły spożywcze", "Wędliny", "Pasztety i pasztetowe", "Pieczenie"],
    }
    prod = AuchanPLScraper._build_product(item, "p1")
    assert prod.raw_category == "Artykuły spożywcze/Wędliny/Pasztety i pasztetowe/Pieczenie"

    # single-segment categoryPath -> that one segment, no leading/trailing "/"
    item2 = dict(item, categoryPath=["Auto-Moto"])
    assert AuchanPLScraper._build_product(item2, "p2").raw_category == "Auto-Moto"

    # missing/empty categoryPath -> None (unchanged from before, honest default)
    item3 = dict(item, categoryPath=[])
    assert AuchanPLScraper._build_product(item3, "p3").raw_category is None
    item4 = {k: v for k, v in item.items() if k != "categoryPath"}
    assert AuchanPLScraper._build_product(item4, "p4").raw_category is None


def test_auchan_pl_parse_v6_malformed_input_returns_empty():
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    assert AuchanPLScraper.parse_v6("not json") == []
    assert AuchanPLScraper.parse_v6("[]") == []
    assert AuchanPLScraper.parse_v6("{}") == []


@pytest.mark.skipif(_AUCHAN_CATEGORIES_FIXTURE is None,
                    reason="no Auchan PL categories fixture (site unreachable at build time)")
def test_auchan_pl_extract_department_ids_reads_taxonomy_fixture():
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    raw = load_fixture(PL_DIR, _AUCHAN_CATEGORIES_FIXTURE.name)
    depts = AuchanPLScraper._extract_department_ids(raw)
    assert ("Artykuły spożywcze", "2091") in depts
    assert ("Alkohole", "3639") in depts
    assert len(depts) == 4


def test_auchan_pl_extract_department_ids_malformed_input_returns_empty():
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    assert AuchanPLScraper._extract_department_ids("not json") == []
    assert AuchanPLScraper._extract_department_ids("{}") == []
    assert AuchanPLScraper._extract_department_ids("[]") == []


@pytest.mark.skipif(_AUCHAN_V6_FIXTURE is None,
                    reason="no Auchan PL v6 fixture (site unreachable at build time)")
def test_auchan_pl_extract_next_page_token_reads_fixture():
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    raw = load_fixture(PL_DIR, _AUCHAN_V6_FIXTURE.name)
    token = AuchanPLScraper._extract_next_page_token(raw)
    assert token == "ae2e0aee-60c4-4760-9c1d-c97199443e6a"


def test_auchan_pl_extract_next_page_token_defaults_on_last_page_or_malformed():
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl").AuchanPLScraper
    assert AuchanPLScraper._extract_next_page_token('{"metadata": {}}') is None
    assert AuchanPLScraper._extract_next_page_token('{"metadata": {"nextPageToken": null}}') is None
    assert AuchanPLScraper._extract_next_page_token("not json") is None
    assert AuchanPLScraper._extract_next_page_token("[]") is None


def test_auchan_pl_discover_department_ids_falls_back_on_empty_response():
    AuchanPLScraper = _load_pl_scraper_module("auchan_pl")
    mod = AuchanPLScraper
    scraper = mod.AuchanPLScraper()
    depts = scraper.discover_department_ids(fetch=lambda url: None)
    assert depts == mod.FALLBACK_DEPARTMENT_IDS


def test_auchan_pl_discover_department_ids_falls_back_on_exception():
    mod = _load_pl_scraper_module("auchan_pl")
    scraper = mod.AuchanPLScraper()

    def _boom(url):
        raise RuntimeError("simulated network failure")

    depts = scraper.discover_department_ids(fetch=_boom)
    assert depts == mod.FALLBACK_DEPARTMENT_IDS


def test_auchan_pl_fetch_products_paginates_and_isolates_department_errors():
    """fetch_products() against an injected department_ids list (no
    network, no discovery) must: follow pageToken until it's absent, dedupe
    by sku across departments/pages, and continue past a department whose
    fetch raises."""
    import json as _json

    mod = _load_pl_scraper_module("auchan_pl")
    AuchanPLScraper = mod.AuchanPLScraper

    def _item(sku, name, price, product_id=None):
        return {
            "productId": product_id or f"pid-{sku}", "retailerProductId": sku, "type": "REGULAR",
            "name": name, "brand": "TestBrand",
            "price": {"amount": price, "currency": "PLN"},
            "categoryPath": ["Dział", "Kategoria", name],
        }

    page1 = _json.dumps({
        "productGroups": [{"type": "ungrouped", "decoratedProducts": [
            _item("1", "Produkt A", "3.50"), _item("2", "Produkt B", "4.20"),
        ]}],
        "metadata": {"nextPageToken": "tok-2"},
    })
    page2 = _json.dumps({
        "productGroups": [{"type": "ungrouped", "decoratedProducts": [
            _item("3", "Produkt C", "2.10"),
        ]}],
        "metadata": {},
    })
    other_dept_dup = _json.dumps({
        "productGroups": [{"type": "ungrouped", "decoratedProducts": [
            _item("1", "Produkt A", "3.50"),  # same sku as dept-a page1 -> deduped
        ]}],
        "metadata": {},
    })

    class FakeResponse:
        def __init__(self, text):
            self.content = text.encode("utf-8")

        def raise_for_status(self):
            pass

    class FakeSession:
        def get(self, url, headers, timeout):
            if "retailerCategoryId=broken" in url:
                raise RuntimeError("simulated network failure")
            if "retailerCategoryId=dept-a" in url and "pageToken=tok-2" in url:
                return FakeResponse(page2)
            if "retailerCategoryId=dept-a" in url:
                return FakeResponse(page1)
            if "retailerCategoryId=dept-b" in url:
                return FakeResponse(other_dept_dup)
            raise AssertionError(f"unexpected url {url}")

    scraper = AuchanPLScraper()
    scraper.delay_between_requests = 0  # keep the test fast
    with mock.patch("requests.Session", return_value=FakeSession()):
        products = scraper.fetch_products(department_ids=[
            ("Broken", "broken"),
            ("Dept A", "dept-a"),
            ("Dept B", "dept-b"),
        ])

    skus = sorted(p.sku for p in products)
    assert skus == ["1", "2", "3"], "expected page-2 product + dedup across departments"
    assert len(products) == 3


def test_auchan_pl_fetch_products_falls_back_to_v5_when_crawl_empty():
    """If every department in the v6 crawl comes back empty, fetch_products()
    must fall back to the Phase-1 curated v5 homepage listing rather than
    returning nothing."""
    mod = _load_pl_scraper_module("auchan_pl")
    AuchanPLScraper = mod.AuchanPLScraper

    empty_v6 = __import__("json").dumps({"productGroups": [], "metadata": {}})
    v5_payload = __import__("json").dumps({
        "productGroups": [{"products": [{"productId": "p1", "product": {
            "productId": "p1", "retailerProductId": "v5sku", "name": "Fallback Produkt",
            "price": {"amount": "9.99", "currency": "PLN"},
            "categoryPath": ["Dział", "Fallback Produkt"],
        }}]}],
    })

    class FakeResponse:
        def __init__(self, text):
            self.text = text
            self.content = text.encode("utf-8")

        def raise_for_status(self):
            pass

    class FakeSession:
        def get(self, url, headers=None, params=None, timeout=None):
            if "v5/product-pages" in url:
                return FakeResponse(v5_payload)
            return FakeResponse(empty_v6)

    scraper = AuchanPLScraper()
    scraper.delay_between_requests = 0
    with mock.patch("requests.Session", return_value=FakeSession()):
        products = scraper.fetch_products(department_ids=[("Dept A", "dept-a")])

    assert len(products) == 1
    assert products[0].sku == "v5sku"
