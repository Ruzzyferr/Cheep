"""marketfiyati.org.tr (resmi TR veri hattı) payload mantığı testleri."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from countries.turkey.marketfiyati import (
    build_price_payloads, _unit_from, _cat_id, STORE_MAP,
)


def _product(pid, depots, title="Test Ürün 500 Gr", brand="TestBrand", refined="500 GR",
             main_category="", menu_category="",
             image="https://cdn.marketfiyati.org.tr/carrefourimages/x.png"):
    return {
        "id": pid, "title": title, "brand": brand, "refinedVolumeOrWeight": refined,
        "imageUrl": image,
        "main_category": main_category, "menu_category": menu_category,
        "productDepotInfoList": depots,
    }


def test_cross_store_key_and_official_image():
    """Ürün id'si çapraz-mağaza anahtarı (mf-<id>); DEVLET CDN'i görseli taşınır.

    NOT — bu test eskiden "görsel ASLA payload'a girmez" diye yazılmıştı ve
    politika değiştiğinde güncellenmediği için aylarca kırık kaldı. Kural artık
    şu: görsel yalnızca devletin resmî CDN'inden (cdn.marketfiyati.org.tr)
    alınır; oradan geldiği için telif sorunu yoktur. Perakendecinin kendi
    sitesinden görsel çekilmez — o iş bu fonksiyonun kapsamında değil.
    """
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
        assert p["image_url"] == "https://cdn.marketfiyati.org.tr/carrefourimages/x.png"
    stores = {p["store_id"] for p in payloads}
    assert stores == {STORE_MAP["migros"], STORE_MAP["a101"]}


def test_missing_or_invalid_image_is_omitted():
    """Görsel yoksa ya da URL bozuksa alan HİÇ eklenmez — backend doğrulaması
    boş/geçersiz image_url'i reddediyor, sessizce ingest'i düşürürdü."""
    for bad in ("", "   ", "ftp://x/y.png", "not-a-url"):
        products = {"7": _product("7", [{"marketAdi": "bim", "price": 10.0}], image=bad)}
        payloads = build_price_payloads(products)
        assert len(payloads) == 1
        assert "image_url" not in payloads[0], f"bozuk URL taşındı: {bad!r}"


def test_image_url_is_percent_encoded():
    """Devlet CDN'inde boşluklu/Türkçe karakterli yollar var; encode edilmezse
    hem URI doğrulaması düşer hem de RN Image görseli yükleyemez."""
    products = {"8": _product("8", [{"marketAdi": "sok", "price": 5.0}],
                              image="https://cdn.marketfiyati.org.tr/a b/çay ürünü.png")}
    payloads = build_price_payloads(products)
    url = payloads[0]["image_url"]
    assert " " not in url
    assert url.startswith("https://cdn.marketfiyati.org.tr/")


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
