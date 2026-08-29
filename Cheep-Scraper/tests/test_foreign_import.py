import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from countries._common.foreign_import import build_api_payloads, ForeignImporter


# NOT: buradaki barkodlar GERCEK kontrol hanesine sahip olmak ZORUNDA.
# `build_payloads` artik barkodu `is_globally_unique_ean` ile dogruluyor
# (magaza-ici GS1 onekleri 20-29 ve bozuk kontrol hanesi reddediliyor), bu
# yuzden "1" gibi yer tutucu degerler `ean_barcode` alanini hic uretmez.
# Eski fixture'lar (7610200000001, "1") tam da bu yuzden dusuyordu.
def test_barcode_maps_to_ean_barcode():
    products = [{
        "name": "Bio Milch 1L", "brand": "Migros", "barcode": "7610200000002",
        "price": 1.55, "unit": "adet", "sku": "MIG-1",
    }]
    payloads = build_api_payloads(products, store_id=10, category_map=None)
    assert len(payloads) == 1
    p = payloads[0]
    assert p["ean_barcode"] == "7610200000002"
    assert p["store_id"] == 10
    assert p["store_sku"] == "MIG-1"
    assert p["price"] == "1.55"          # sent as decimal string
    assert p["source"] == "scrape"
    assert p["name"] == "Bio Milch 1L"


def test_missing_barcode_omits_ean_field():
    products = [{"name": "Brot 500g", "price": 2.0, "sku": "X1"}]
    payloads = build_api_payloads(products, store_id=30, category_map=None)
    assert "ean_barcode" not in payloads[0]
    # store_sku falls back to a deterministic value when sku is absent
    payloads2 = build_api_payloads([{"name": "Brot 500g", "price": 2.0}], store_id=30, category_map=None)
    assert payloads2[0]["store_sku"]


def test_fallback_store_sku_is_stable_regardless_of_list_position():
    """The fallback store_sku must NOT depend on the product's index in the list,
    otherwise a reordered weekly scrape creates duplicate rows in the backend
    (store_id_store_sku upsert key)."""
    product = {"name": "Brot 500g", "price": 2.0}
    other = {"name": "Milch 1L", "price": 1.0, "sku": "M1"}

    payloads_a = build_api_payloads([product, other], store_id=30, category_map=None)
    payloads_b = build_api_payloads([other, other, product], store_id=30, category_map=None)

    sku_a = payloads_a[0]["store_sku"]
    sku_b = payloads_b[2]["store_sku"]
    assert sku_a
    assert sku_a == sku_b


def test_fallback_store_sku_nonempty_for_non_alphanumeric_name():
    payloads = build_api_payloads([{"name": "!!!", "price": 1.0}], store_id=30, category_map=None)
    assert payloads[0]["store_sku"]


def test_malformed_image_url_omitted_clean_url_passed_through():
    """A `{stack}`-style placeholder (Migros CH) or a relative URL must never
    reach the payload — the backend's Joi URI validator would reject it and
    fail the ENTIRE bulk-upsert chunk for one bad image_url. A clean absolute
    URL should still pass through unchanged."""
    products = [
        {"name": "Milch 1L", "price": 1.5, "sku": "A1",
         "image_url": "https://image.migros.ch/d/{stack}/hash.png"},
        {"name": "Brot 500g", "price": 2.0, "sku": "A2",
         "image_url": "/relative/path.png"},
        {"name": "Cola 2L", "price": 1.2, "sku": "A3",
         "image_url": "https://cdn.example.com/clean.png"},
    ]
    payloads = build_api_payloads(products, store_id=10, category_map=None)
    assert "image_url" not in payloads[0]
    assert "image_url" not in payloads[1]
    assert payloads[2]["image_url"] == "https://cdn.example.com/clean.png"


def test_unit_defaults_and_passthrough():
    payloads = build_api_payloads([{"name": "Cola 2L", "price": 1.2, "unit": "l", "sku": "C"}], 31, None)
    assert payloads[0]["unit"] == "l"
    payloads2 = build_api_payloads([{"name": "Egg", "price": 3.0, "sku": "E"}], 31, None)
    assert payloads2[0]["unit"] == "adet"


def test_importer_sends_country_and_key_headers(monkeypatch):
    captured = {}

    class FakeResp:
        ok = True
        status_code = 200
        content = b"{}"
        def json(self): return {"successful": 1, "success_count": 1}
        def raise_for_status(self): pass

    def fake_post(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["body"] = json
        return FakeResp()

    import countries._common.foreign_import as fi
    monkeypatch.setattr(fi.requests, "post", fake_post)

    importer = ForeignImporter("http://localhost:3000/api/v1", country_code="DE", api_key="secret")
    result = importer.import_products(
        [{"name": "Milch", "price": 1.0, "sku": "M", "barcode": "5901234123457"}], store_id=30,
    )
    assert captured["url"].endswith("/store-prices/bulk-upsert")
    assert captured["headers"]["x-country"] == "DE"
    assert captured["headers"]["x-api-key"] == "secret"
    assert captured["body"]["prices"][0]["ean_barcode"] == "5901234123457"
    assert result["successful"] == 1


def test_importer_survives_malformed_json_body(monkeypatch):
    """An HTTP-200-but-malformed body must count the chunk as failed and continue,
    not raise json.JSONDecodeError and abort the whole import."""

    class MalformedResp:
        ok = True
        status_code = 200
        content = b"not json"
        def json(self):
            raise ValueError("Expecting value: line 1 column 1 (char 0)")
        def raise_for_status(self): pass

    def fake_post(url, json=None, headers=None, timeout=None):
        return MalformedResp()

    import countries._common.foreign_import as fi
    monkeypatch.setattr(fi.requests, "post", fake_post)

    importer = ForeignImporter("http://localhost:3000/api/v1", country_code="DE", api_key="secret")
    result = importer.import_products(
        [{"name": "Milch", "price": 1.0, "sku": "M", "barcode": "5901234123457"}], store_id=30,
    )
    assert result["failed"] == 1
    assert result["successful"] == 0


# --------------------------------------------- acik, GTIN olmayan birlestirme anahtari

def test_merge_key_is_forwarded_when_there_is_no_valid_ean():
    """Romanya'da barkod yok ama devletin kanonik urun kimligi (`catprod.id`)
    var. Onu atmak, elimizdeki en iyi eslestirme sinyalini bulanik isim
    benzerligiyle degistirmek olurdu."""
    payloads = build_api_payloads(
        [{"name": "LAPTE ZUZU 1.5% 1L", "price": 7.49, "merge_key": "catprod:1016498"}],
        store_id=70,
    )
    assert payloads[0]["ean_barcode"] == "catprod:1016498"


def test_real_ean_wins_over_merge_key():
    """Gercek GTIN kuresel olarak benzersiz; ulkeye kapsamli bir anahtardan
    her zaman ustundur (urun sinirlar otesinde de birlesebilir)."""
    payloads = build_api_payloads(
        [{
            "name": "Milka 100g", "price": 1.99,
            "barcode": "7622210043931", "merge_key": "catprod:999",
        }],
        store_id=70,
    )
    assert payloads[0]["ean_barcode"] == "7622210043931"


def test_merge_key_is_used_when_barcode_is_invalid():
    """Gecersiz barkod (magaza-ici 2x oneki ya da kontrol hanesi tutmayan)
    dusuruluyor; merge_key varsa devreye girmeli."""
    payloads = build_api_payloads(
        [{
            "name": "BRANZA CANTAR", "price": 12.0,
            "barcode": "2030269600008", "merge_key": "catprod:42",
        }],
        store_id=70,
    )
    assert payloads[0]["ean_barcode"] == "catprod:42"


def test_no_merge_key_and_no_valid_ean_means_no_barcode_field():
    payloads = build_api_payloads(
        [{"name": "Isimsiz urun", "price": 5.0, "barcode": "2030269600008"}],
        store_id=70,
    )
    assert "ean_barcode" not in payloads[0]
