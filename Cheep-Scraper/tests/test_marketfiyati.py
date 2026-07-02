"""marketfiyati.org.tr (resmi TR veri hattı) payload mantığı testleri."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from countries.turkey.marketfiyati import (
    build_price_payloads, _unit_from, _cat_id, STORE_MAP,
)


def _product(pid, depots, title="Test Ürün 500 Gr", brand="TestBrand", refined="500 GR",
             main_category="", menu_category=""):
    return {
        "id": pid, "title": title, "brand": brand, "refinedVolumeOrWeight": refined,
        "imageUrl": "https://cdn.marketfiyati.org.tr/carrefourimages/x.png",  # ATLANMALI (telif)
        "main_category": main_category, "menu_category": menu_category,
        "productDepotInfoList": depots,
    }


def test_cross_store_key_and_no_image():
    """Ürün id'si çapraz-mağaza anahtarı (mf-<id>); GÖRSEL ASLA payload'a girmez."""
    products = {"2166": _product("2166", [
        {"marketAdi": "migros", "price": 46.95},
        {"marketAdi": "a101", "price": 44.50},
    ])}
    payloads = build_price_payloads(products)
    assert len(payloads) == 2
    for p in payloads:
        assert p["ean_barcode"] == "mf-2166"       # çapraz-mağaza birleştirme anahtarı
        assert p["store_sku"] == "mf-2166"
        assert p["source"] == "api"                # dürüst kaynak etiketi
        assert "image_url" not in p                # RETAILER GÖRSELİ İNGEST EDİLMEZ (telif)
    stores = {p["store_id"] for p in payloads}
    assert stores == {STORE_MAP["migros"], STORE_MAP["a101"]}


def test_one_price_per_chain_takes_min():
    """Aynı zincirin birden çok deposu → en düşük tek fiyat."""
    products = {"9": _product("9", [
        {"marketAdi": "migros", "price": 50.0},
        {"marketAdi": "migros", "price": 42.0},   # daha ucuz depo
        {"marketAdi": "migros", "price": 47.0},
    ])}
    payloads = build_price_payloads(products)
    assert len(payloads) == 1
    assert payloads[0]["price"] == "42.00"
    assert payloads[0]["store_id"] == STORE_MAP["migros"]


def test_unknown_market_and_bad_price_skipped():
    products = {"7": _product("7", [
        {"marketAdi": "bilinmeyen_market", "price": 10.0},  # eşlenmeyen zincir → atla
        {"marketAdi": "sok", "price": 0},                    # geçersiz fiyat → atla
        {"marketAdi": "bim", "price": -5},                   # negatif → atla
        {"marketAdi": "carrefour", "price": 12.5},           # geçerli
    ])}
    payloads = build_price_payloads(products)
    assert len(payloads) == 1
    assert payloads[0]["store_id"] == STORE_MAP["carrefour"]


def test_unit_inference():
    assert _unit_from("500 GR") == "adet"     # paket fiyatı
    assert _unit_from("1 KG") == "kg"
    assert _unit_from("2.5 Kilogram") == "kg"
    assert _unit_from("1 L") == "l"
    assert _unit_from("Litre") == "l"
    assert _unit_from("") == "adet"


def test_brand_and_name_forwarded():
    products = {"5": _product("5", [{"marketAdi": "bim", "price": 20.0}],
                              title="Ülker Çikolatalı Gofret 40 Gr", brand="Ülker")}
    p = build_price_payloads(products)[0]
    assert p["name"] == "Ülker Çikolatalı Gofret 40 Gr"
    assert p["brand"] == "Ülker"


def test_empty_or_short_name_skipped():
    products = {"1": _product("1", [{"marketAdi": "bim", "price": 20.0}], title="")}
    assert build_price_payloads(products) == []


def test_category_mapping_to_subcategories():
    """main_category → Cheep ALT-kategori id (granüler, deterministik)."""
    assert _cat_id("Çikolata") == 86          # Atıştırmalık › Çikolata
    assert _cat_id("Süt") == 2                 # Süt Ürünleri › Süt
    assert _cat_id("Peynir") == 3              # Süt Ürünleri › Peynir
    assert _cat_id("Beyaz Et") == 22           # Et › Tavuk
    assert _cat_id("Su") == 53                 # İçecek › Su
    assert _cat_id("Bebek ve Hasta Bezi") == 172
    assert _cat_id("Kağıt Peçete ve Mendiller") == 138
    assert _cat_id("Cips") == 90
    # map'te yok → ada göre üst kategori yedeği
    assert _cat_id("Süt Bazlı Bir Şey") == 1   # 'süt' → Süt Ürünleri (üst)
    # hiç eşleşme → Diğer(246)
    assert _cat_id("Zzz Qqq Bilinmeyen") == 246


def test_payload_carries_subcategory_id():
    products = {"3": _product("3", [{"marketAdi": "migros", "price": 20.0}],
                              title="Sütaş Yoğurt", main_category="Yoğurt")}
    p = build_price_payloads(products)[0]
    assert p["category_id"] == 4  # Süt Ürünleri › Yoğurt
