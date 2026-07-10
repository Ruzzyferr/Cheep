import importlib.util
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
