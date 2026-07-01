import importlib.util
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
SE_DIR = ROOT / "countries" / "sweden"

from countries._common.category import assert_valid_products
from countries._common.fixture_harness import load_fixture

FIXTURES = SE_DIR / "fixtures"


def _load_se_scraper_module(name: str):
    """Load countries/sweden/scrapers/<name>.py by absolute file path.

    Deliberately NOT `sys.path.insert(0, SE_DIR); from scrapers.<name> import
    ...`: this country's own scraper directory is named `scrapers`, same as
    the repo-root package that other tests in this suite (test_matching.py,
    test_unit_parser.py) import at module scope. Whichever one wins the bare
    name `scrapers` in `sys.modules` first stays cached for the rest of the
    pytest session — a name-based import here is collection-order-dependent
    and, tried the naive way, either fails itself or breaks those other
    tests' `from scrapers.units import ...`. Loading by explicit file path
    sidesteps the collision entirely; it never touches `sys.modules["scrapers"]`.
    """
    path = SE_DIR / "scrapers" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"se_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.skipif(not (FIXTURES / "ica_sample.json").exists(),
                    reason="no ICA fixture (site unreachable at build time)")
def test_ica_parses_fixture():
    ICAScraper = _load_se_scraper_module("ica").ICAScraper
    raw = load_fixture(SE_DIR, "ica_sample.json")
    products = ICAScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "SE" for p in products)
    assert all(p.store == "ICA" for p in products)


@pytest.mark.skipif(not (FIXTURES / "willys_sample.json").exists(),
                    reason="no Willys fixture (site unreachable at build time)")
def test_willys_parses_fixture():
    WillysScraper = _load_se_scraper_module("willys").WillysScraper
    raw = load_fixture(SE_DIR, "willys_sample.json")
    products = WillysScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "SE" for p in products)
    assert all(p.store == "Willys" for p in products)
