import importlib.util
import sys
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
CH_DIR = ROOT / "countries" / "switzerland"

from countries._common.category import assert_valid_products
from countries._common.fixture_harness import load_fixture

FIXTURES = CH_DIR / "fixtures"


def _load_ch_scraper_module(name: str):
    """Load countries/switzerland/scrapers/<name>.py by absolute file path.

    Deliberately NOT `sys.path.insert(0, CH_DIR); from scrapers.<name> import
    ...`: this country's own scraper directory is named `scrapers`, same as
    the repo-root package that other tests in this suite (test_matching.py,
    test_unit_parser.py) import at module scope. Whichever one wins the bare
    name `scrapers` in `sys.modules` first stays cached for the rest of the
    pytest session — a name-based import here is collection-order-dependent
    and, tried the naive way, either fails itself or breaks those other
    tests' `from scrapers.units import ...`. Loading by explicit file path
    sidesteps the collision entirely; it never touches `sys.modules["scrapers"]`.
    """
    path = CH_DIR / "scrapers" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(f"ch_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.skipif(not (FIXTURES / "migros_ch_sample.json").exists(),
                    reason="no Migros CH fixture (site unreachable at build time)")
def test_migros_ch_parses_fixture():
    MigrosCHScraper = _load_ch_scraper_module("migros_ch").MigrosCHScraper
    raw = load_fixture(CH_DIR, "migros_ch_sample.json")
    products = MigrosCHScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "CH" for p in products)
    assert all(p.store == "Migros" for p in products)


@pytest.mark.skipif(not (FIXTURES / "coop_ch_sample.html").exists() and not (FIXTURES / "coop_ch_sample.json").exists(),
                    reason="no Coop CH fixture (site unreachable at build time)")
def test_coop_ch_parses_fixture():
    CoopCHScraper = _load_ch_scraper_module("coop_ch").CoopCHScraper
    name = "coop_ch_sample.json" if (FIXTURES / "coop_ch_sample.json").exists() else "coop_ch_sample.html"
    raw = load_fixture(CH_DIR, name)
    products = CoopCHScraper.parse(raw)
    assert_valid_products(products)
    assert all(p.country_code == "CH" for p in products)
