import json
from countries._common.off_enrich import OffEnricher


class FakeResp:
    def __init__(self, payload): self._p = payload; self.ok = True
    def json(self): return self._p


class FakeSession:
    def __init__(self, payload): self.payload = payload; self.calls = 0
    def get(self, url, params=None, timeout=None, headers=None):
        self.calls += 1
        return FakeResp(self.payload)


def _off(products):
    return {"products": products}


def test_single_confident_candidate_enriches(tmp_path):
    session = FakeSession(_off([
        {"code": "5900820000011", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "1 l"},
    ]))
    e = OffEnricher("PL", str(tmp_path / "off.db"), session=session)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "price": 4.59, "barcode": None}]
    stats = e.enrich(products)
    assert products[0]["barcode"] == "5900820000011"
    assert stats["enriched"] == 1


def test_ambiguous_candidates_do_not_enrich(tmp_path):
    session = FakeSession(_off([
        {"code": "5900820000011", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "1 l"},
        {"code": "5900820000028", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "1 l"},
    ]))
    e = OffEnricher("PL", str(tmp_path / "off.db"), session=session)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "price": 4.59, "barcode": None}]
    stats = e.enrich(products)
    assert products[0]["barcode"] is None
    assert stats["ambiguous"] == 1


def test_quantity_mismatch_rejected(tmp_path):
    session = FakeSession(_off([
        {"code": "5900820000035", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "500 ml"},
    ]))
    e = OffEnricher("PL", str(tmp_path / "off.db"), session=session)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "price": 4.59, "barcode": None}]
    e.enrich(products)
    assert products[0]["barcode"] is None


def test_cache_prevents_second_lookup(tmp_path):
    session = FakeSession(_off([
        {"code": "5900820000011", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "1 l"},
    ]))
    e = OffEnricher("PL", str(tmp_path / "off.db"), session=session)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "price": 4.59, "barcode": None}]
    e.enrich(products)
    products[0]["barcode"] = None
    stats = e.enrich(products)
    assert session.calls == 1  # ikinci tur cache'ten
    assert products[0]["barcode"] == "5900820000011"
    assert stats["cache_hits"] == 1
