import importlib.util
import sys
from pathlib import Path
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
