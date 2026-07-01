import importlib.util
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DE_DIR = ROOT / "countries" / "germany"

from countries._common.category import assert_valid_products
from countries._common.fixture_harness import load_fixture

FIXTURES = DE_DIR / "fixtures"


def _load_de_scraper_module(name: str):
    """Load countries/germany/scrapers/<name>.py by absolute file path.

    Deliberately NOT `sys.path.insert(0, DE_DIR); from scrapers.<name> import
    ...`: this country's own scraper directory is named `scrapers`, same as
    the repo-root package that other tests in this suite (test_matching.py,
    test_unit_parser.py) import at module scope. Whichever one wins the bare
    name `scrapers` in `sys.modules` first stays cached for the rest of the
    pytest session — a name-based import here is collection-order-dependent
    and, tried the naive way, either fails itself or breaks those other
    tests' `from scrapers.units import ...`. Loading by explicit file path
    sidesteps the collision entirely; it never touches `sys.modules["scrapers"]`.
    """
    path = DE_DIR / "scrapers" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"de_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.skipif(not (FIXTURES / "rewe_sample.json").exists(),
                    reason="no REWE fixture (site unreachable at build time)")
def test_rewe_parses_fixture():
    REWEScraper = _load_de_scraper_module("rewe").REWEScraper
    raw = load_fixture(DE_DIR, "rewe_sample.json")
    products = REWEScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "DE" for p in products)
    assert all(p.store == "REWE" for p in products)


@pytest.mark.skipif(not (FIXTURES / "kaufland_de_sample.json").exists(),
                    reason="no Kaufland fixture (site unreachable at build time)")
def test_kaufland_de_parses_fixture():
    KauflandDEScraper = _load_de_scraper_module("kaufland_de").KauflandDEScraper
    raw = load_fixture(DE_DIR, "kaufland_de_sample.json")
    products = KauflandDEScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "DE" for p in products)
    assert all(p.store == "Kaufland" for p in products)
