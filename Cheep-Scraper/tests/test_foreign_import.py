import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from countries._common.foreign_import import build_api_payloads, ForeignImporter


def test_barcode_maps_to_ean_barcode():
    products = [{
        "name": "Bio Milch 1L", "brand": "Migros", "barcode": "7610200000001",
        "price": 1.55, "unit": "adet", "sku": "MIG-1",
    }]
    payloads = build_api_payloads(products, store_id=10, category_map=None)
    assert len(payloads) == 1
    p = payloads[0]
    assert p["ean_barcode"] == "7610200000001"
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
        [{"name": "Milch", "price": 1.0, "sku": "M", "barcode": "1"}], store_id=30,
    )
    assert captured["url"].endswith("/store-prices/bulk-upsert")
    assert captured["headers"]["x-country"] == "DE"
    assert captured["headers"]["x-api-key"] == "secret"
    assert captured["body"]["prices"][0]["ean_barcode"] == "1"
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
        [{"name": "Milch", "price": 1.0, "sku": "M", "barcode": "1"}], store_id=30,
    )
    assert result["failed"] == 1
    assert result["successful"] == 0
