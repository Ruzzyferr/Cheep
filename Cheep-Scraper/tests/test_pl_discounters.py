import importlib.util
import json
import sys
from pathlib import Path
import pytest
from unittest import mock

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


_BIEDRONKA_FIXTURE = _first_fixture("biedronka_sample.html", "biedronka_sample.json")
_BIEDRONKA_SITEMAP_FIXTURE = _first_fixture("biedronka_sitemap_sample.xml")
_BIEDRONKA_NAV_FIXTURE = _first_fixture("biedronka_nav_sample.html")
_BIEDRONKA_PAGINATION_FIXTURE = _first_fixture("biedronka_pagination_sample.html")
_LIDL_PL_FIXTURE = _first_fixture("lidl_pl_sample.json", "lidl_pl_sample.html")
_ZABKA_FIXTURE = _first_fixture("zabka_sample.html", "zabka_sample.json")


@pytest.mark.skipif(_BIEDRONKA_FIXTURE is None,
                    reason="no Biedronka fixture (site unreachable at build time)")
def test_biedronka_parses_fixture():
    BiedronkaScraper = _load_pl_scraper_module("biedronka").BiedronkaScraper
    raw = load_fixture(PL_DIR, _BIEDRONKA_FIXTURE.name)
    products = BiedronkaScraper.parse(raw)
    assert_valid_products(products)
    assert len(products) > 0
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Biedronka" for p in products)


@pytest.mark.skipif(_BIEDRONKA_SITEMAP_FIXTURE is None,
                    reason="no Biedronka sitemap fixture (site unreachable at build time)")
def test_biedronka_sitemap_discovery_filters_and_reduces_to_leaves():
    """Sitemap -> _extract_sitemap_locs -> _filter_category_urls ->
    _reduce_to_leaves must: drop product-detail (.html) URLs, drop
    promo/merchandising bucket pages (single-segment slugs not in
    DEPARTMENT_PREFIXES), and drop non-leaf department/subcategory pages
    that have a deeper sibling also present in the sitemap."""
    mod = _load_pl_scraper_module("biedronka")
    BiedronkaScraper = mod.BiedronkaScraper
    xml = load_fixture(PL_DIR, _BIEDRONKA_SITEMAP_FIXTURE.name)

    locs = BiedronkaScraper._extract_sitemap_locs(xml)
    assert any(l.endswith(".html") for l in locs), "fixture should include product URLs"

    filtered = BiedronkaScraper._filter_category_urls(locs)
    # product detail pages must be gone
    assert not any(u.endswith(".html") for u in filtered)
    # promo/bucket pages must be excluded
    assert not any("promocje-nabial" in u for u in filtered)
    assert not any("strefa-fit-1" in u for u in filtered)
    assert not any("bestsellery-2" in u for u in filtered)
    assert not any(u.rstrip("/").endswith("/home") or u.rstrip("/") == f"{mod.BASE}/home"
                   for u in filtered)
    # real nested category paths must be kept
    assert f"{mod.BASE}/nabial/mleko/" in filtered
    assert f"{mod.BASE}/mieso/wedliny/wedliny-w-plastrach/" in filtered

    leaves = BiedronkaScraper._reduce_to_leaves(filtered)
    # non-leaf ancestors dropped: /nabial/ has a child /nabial/mleko/, etc.
    assert f"{mod.BASE}/nabial/" not in leaves
    assert f"{mod.BASE}/nabial/sery/" not in leaves
    assert f"{mod.BASE}/mieso/" not in leaves
    assert f"{mod.BASE}/mieso/wedliny/" not in leaves
    # true leaves survive
    assert f"{mod.BASE}/nabial/mleko/" in leaves
    assert f"{mod.BASE}/nabial/sery/sery-zolte/" in leaves
    assert f"{mod.BASE}/mieso/wedliny/wedliny-w-plastrach/" in leaves
    assert f"{mod.BASE}/napoje/woda/" in leaves


@pytest.mark.skipif(_BIEDRONKA_NAV_FIXTURE is None,
                    reason="no Biedronka nav fixture (site unreachable at build time)")
def test_biedronka_nav_fallback_discovery_filters_to_categories():
    """Homepage-nav fallback must keep only department-rooted category
    links and drop non-category hrefs (blog, cart, external)."""
    mod = _load_pl_scraper_module("biedronka")
    BiedronkaScraper = mod.BiedronkaScraper
    nav_html = load_fixture(PL_DIR, _BIEDRONKA_NAV_FIXTURE.name)

    cats = BiedronkaScraper._extract_nav_category_urls(nav_html)
    assert f"{mod.BASE}/nabial/mleko/" in cats
    assert f"{mod.BASE}/mieso/wedliny/" in cats
    assert not any("blog" in u for u in cats)
    assert not any("cart" in u for u in cats)
    assert not any("facebook" in u for u in cats)


@pytest.mark.skipif(_BIEDRONKA_PAGINATION_FIXTURE is None,
                    reason="no Biedronka pagination fixture (site unreachable at build time)")
def test_biedronka_pagination_info_has_next_true():
    BiedronkaScraper = _load_pl_scraper_module("biedronka").BiedronkaScraper
    html_text = load_fixture(PL_DIR, _BIEDRONKA_PAGINATION_FIXTURE.name)
    has_next, total_items = BiedronkaScraper._extract_pagination_info(html_text)
    assert has_next is True
    assert total_items == 74


@pytest.mark.skipif(_BIEDRONKA_FIXTURE is None,
                    reason="no Biedronka fixture (site unreachable at build time)")
def test_biedronka_pagination_info_has_next_false_on_single_page_category():
    """The existing full-page fixture (10-of-10 dairy products) has no
    further page — data-has-next="false" — exercising the loop's other
    branch without a second large fixture."""
    BiedronkaScraper = _load_pl_scraper_module("biedronka").BiedronkaScraper
    html_text = load_fixture(PL_DIR, _BIEDRONKA_FIXTURE.name)
    has_next, total_items = BiedronkaScraper._extract_pagination_info(html_text)
    assert has_next is False
    assert total_items == 10


def test_biedronka_fetch_products_paginates_and_isolates_category_errors():
    """fetch_products() against an injected category_urls list (no
    network, no discovery) must: follow ?page=N while data-has-next is
    true, stop when it goes false, dedupe by sku across categories/pages,
    and continue past a category whose fetch raises."""
    mod = _load_pl_scraper_module("biedronka")
    BiedronkaScraper = mod.BiedronkaScraper

    def _tile(item_id, name, price, category="Testowa"):
        gtm = {
            "item_name": name, "item_id": item_id, "price": price,
            "item_brand": "TestBrand", "item_category3": category,
        }
        gtm_json = json.dumps(gtm).replace('"', "&quot;")
        return (
            '<div class="product-tile js-product-tile" data-itemid="%s">'
            '<meta itemprop="image" content="/img/%s.jpg" />'
            '<span data-product-gtm="%s"></span>'
            "</div>" % (item_id, item_id, gtm_json)
        )

    page1 = (
        '<span class="refinements__total-items">3 produkty</span>'
        + _tile("1", "Produkt A 1 l", "3.50")
        + _tile("2", "Produkt B 500 g", "4.20")
        + '<ul class="product-grid" data-has-next="true"></ul>'
    )
    page2 = (
        '<span class="refinements__total-items">3 produkty</span>'
        + _tile("3", "Produkt C 200 g", "2.10")
        + '<ul class="product-grid" data-has-next="false"></ul>'
    )
    other_category_dup = (
        '<span class="refinements__total-items">1 produkty</span>'
        + _tile("1", "Produkt A 1 l", "3.50")  # same sku as page1 -> deduped
        + '<ul class="product-grid" data-has-next="false"></ul>'
    )

    responses = {
        "https://zakupy.biedronka.pl/cat-a/": page1,
        "https://zakupy.biedronka.pl/cat-a/?page=2": page2,
        "https://zakupy.biedronka.pl/cat-b/": other_category_dup,
    }

    def fake_get(url, headers, timeout):
        if url == "https://zakupy.biedronka.pl/cat-broken/":
            raise RuntimeError("simulated network failure")
        class Resp:
            content = responses[url].encode("utf-8")
            def raise_for_status(self):
                pass
        return Resp()

    scraper = BiedronkaScraper()
    scraper.delay_between_requests = 0  # keep the test fast
    with mock.patch("requests.get", side_effect=fake_get):
        products = scraper.fetch_products(category_urls=[
            "https://zakupy.biedronka.pl/cat-broken/",
            "https://zakupy.biedronka.pl/cat-a/",
            "https://zakupy.biedronka.pl/cat-b/",
        ])

    skus = sorted(p.sku for p in products)
    assert skus == ["1", "2", "3"], "expected page-2 product + dedup across categories"
    assert len(products) == 3


@pytest.mark.skipif(_LIDL_PL_FIXTURE is None,
                    reason="no Lidl PL fixture (site unreachable at build time)")
def test_lidl_pl_parses_fixture():
    LidlPLScraper = _load_pl_scraper_module("lidl_pl").LidlPLScraper
    raw = load_fixture(PL_DIR, _LIDL_PL_FIXTURE.name)
    products = LidlPLScraper.parse(raw)
    assert_valid_products(products)
    assert len(products) > 0
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Lidl" for p in products)


@pytest.mark.skipif(_ZABKA_FIXTURE is None,
                    reason="no Żabka fixture (site unreachable at build time)")
def test_zabka_parses_fixture():
    ZabkaScraper = _load_pl_scraper_module("zabka").ZabkaScraper
    raw = load_fixture(PL_DIR, _ZABKA_FIXTURE.name)
    products = ZabkaScraper.parse(raw)
    assert_valid_products(products)
    assert len(products) > 0
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Żabka" for p in products)


@pytest.mark.skipif(_ZABKA_FIXTURE is None,
                    reason="no Żabka fixture (site unreachable at build time)")
def test_zabka_charset_handling_regression():
    """Verify fetch_products() correctly handles server with no charset.

    Regression test for: zabka.pl serves Content-Type: text/html without charset
    declaration, causing requests to default to ISO-8859-1. Polish characters
    become mojibake when read as .text, breaking parse(). fetch_products()
    must decode .content as UTF-8 instead.
    """
    ZabkaScraper = _load_pl_scraper_module("zabka").ZabkaScraper

    # Read the fixture as raw bytes
    fixture_bytes = (_ZABKA_FIXTURE).read_bytes()

    # Create a mock response that simulates the mojibake scenario:
    # .content is the correct UTF-8 bytes
    # .text is the broken ISO-8859-1 mojibake decode (what requests would do)
    mock_response = mock.Mock()
    mock_response.content = fixture_bytes
    mock_response.text = fixture_bytes.decode("iso-8859-1", errors="replace")
    mock_response.raise_for_status = mock.Mock()

    # Patch requests.get to return our mock response
    with mock.patch("requests.get", return_value=mock_response):
        scraper = ZabkaScraper()
        products = scraper.fetch_products()

    # Verify the fix works: parse succeeded with UTF-8 decode
    assert len(products) > 0, "fetch_products() should parse > 0 products from fixture"
    assert_valid_products(products)
    assert all(p.country_code == "PL" for p in products)
    assert all(p.store == "Żabka" for p in products)
