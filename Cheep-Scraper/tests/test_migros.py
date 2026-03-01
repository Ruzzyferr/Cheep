import pytest
from decimal import Decimal
from migros.migros_scraper import MigrosScraper

# Scraper'dan bir örnek (instance) oluşturalım
@pytest.fixture
def scraper():
    return MigrosScraper()

def test_parse_price(scraper):
    """Fiyat parse etme metodunu test eder."""
    assert scraper.parse_price("33,00 TL") == Decimal("33.00")
    assert scraper.parse_price("244,90 TL") == Decimal("244.90")
    assert scraper.parse_price("1.250,50 ₺") == Decimal("1250.50")

def test_parse_unit_info(scraper):
    """Birim parse etme metodunu test eder."""
    quantity, unit = scraper.parse_unit_info("(733,11 TL/Kg)")
    assert quantity == 1.0
    assert unit == "kg"

    quantity, unit = scraper.parse_unit_info("(6,63 TL/Adet)")
    assert quantity == 1.0
    assert unit == "adet"

def test_extract_brand_from_name(scraper):
    """Marka çıkarma fonksiyonunu test eder."""
    assert scraper.extract_brand_from_name("Migros Yoğurt 500 g") == "Migros"
    assert scraper.extract_brand_from_name("Pınar Süt 1 L") == "Pınar"
    assert scraper.extract_brand_from_name("Bilinmeyen Marka Cips") == "Bilinmeyen"

# Not: Bu test canlı siteye istek atacağı için yavaş çalışabilir.
# Gerçek projelerde 'mocking' teknikleri kullanılır.
def test_scrape_single_category_returns_products(scraper):
    """Tek bir kategorinin en az bir ürün döndürdüğünü test eder."""
    # Sadece bir kategori URL'i ile test edelim
    url = "https://www.migros.com.tr/sut-kahvaltilik-c-4"
    products = scraper.scrape_category(url, "Süt & Kahvaltılık")

    # Kategorinin boş olmamasını bekleriz
    assert len(products) > 0

    # İlk ürünün geçerli bir Product nesnesi olduğunu kontrol edelim
    first_product = products[0]
    assert first_product.name is not None
    assert first_product.price > 0
    assert first_product.store == "Migros"