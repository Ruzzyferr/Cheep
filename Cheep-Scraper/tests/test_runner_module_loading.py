"""Runner'ın scraper modüllerini yükleme biçimi.

ÜRETİMDE YAKALANAN HATA: modül `spec_from_file_location` ile yükleniyor ama
`sys.modules`'e KAYDEDİLMİYORDU. `dataclasses`, alan tipleri string olduğunda
(modül `from __future__ import annotations` kullanıyorsa) tipi çözmek için
`sys.modules.get(cls.__module__).__dict__` yapıyor; kayıt yoksa None döner ve
dataclass TANIMI patlar.

Arıza sinsi: hata içe aktarımda çıktığı için runner o marketi "sıfır ürün"
sanıyor, market özetten düşüyor ve koşum "hiç market taranmadı" diye bitiyor.
Aynı scraper yerelde düz `import` ile sorunsuz çalıştığı için de fark
edilmiyor — yalnızca config üzerinden, yani yalnızca üretimde ortaya çıkıyor.
"""
import sys
import textwrap

import pytest

from countries._common.runner import CountryScraperRunner


DATACLASS_SCRAPER = textwrap.dedent('''
    """Üretimdeki üç yeni ülkenin scraper'larıyla AYNI desen."""
    from __future__ import annotations

    from dataclasses import dataclass, asdict
    from typing import Dict, List, Optional


    @dataclass
    class Product:
        name: str
        price: float
        brand: Optional[str] = None

        def to_dict(self) -> Dict:
            return asdict(self)


    class DemoScraper:
        def fetch_products(self) -> List[Dict]:
            return [Product(name="Test", price=1.0).to_dict()]
''')


@pytest.fixture
def country_dir(tmp_path):
    (tmp_path / "scrapers").mkdir()
    (tmp_path / "scrapers" / "demo.py").write_text(DATACLASS_SCRAPER, encoding="utf-8")
    config = tmp_path / "config.json"
    config.write_text(
        '{"country": "Test", "country_code": "XX", "markets": [{'
        '"name": "Demo", "store_id": 1, "scraper_path": "scrapers/demo.py",'
        '"scraper_class": "DemoScraper", "scraper_method": "fetch_products",'
        '"output_pattern": "demo_{timestamp}.json", "enabled": true}]}',
        encoding="utf-8",
    )
    return config


def test_postponed_annotations_scraper_loads(country_dir):
    """`from __future__ import annotations` + @dataclass kullanan bir scraper
    config üzerinden yüklenebilmeli."""
    runner = CountryScraperRunner(str(country_dir))
    market = runner.config["markets"][0]
    scraper = runner._load_scraper_module(market)
    assert scraper.fetch_products() == [{"name": "Test", "price": 1.0, "brand": None}]


def test_module_is_registered_in_sys_modules(country_dir):
    runner = CountryScraperRunner(str(country_dir))
    market = runner.config["markets"][0]
    runner._load_scraper_module(market)
    assert "scraper_demo" in sys.modules
    del sys.modules["scraper_demo"]


def test_broken_module_is_not_left_registered(tmp_path):
    """Yarım yüklenmiş modül kayıtta KALMAMALI — sonraki market aynı adı
    kullanırsa bozuk modülü devralırdı."""
    (tmp_path / "scrapers").mkdir()
    (tmp_path / "scrapers" / "bad.py").write_text("raise RuntimeError('bozuk')", encoding="utf-8")
    config = tmp_path / "config.json"
    config.write_text(
        '{"country": "Test", "country_code": "XX", "markets": [{'
        '"name": "Bad", "store_id": 1, "scraper_path": "scrapers/bad.py",'
        '"scraper_class": "X", "scraper_method": "fetch_products",'
        '"output_pattern": "x_{timestamp}.json", "enabled": true}]}',
        encoding="utf-8",
    )
    runner = CountryScraperRunner(str(config))
    with pytest.raises(RuntimeError):
        runner._load_scraper_module(runner.config["markets"][0])
    assert "scraper_bad" not in sys.modules
