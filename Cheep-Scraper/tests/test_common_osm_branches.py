"""Ortak (ülkeden bağımsız) OSM şube toplayıcısının saf fonksiyonları.

Şube verisi sessizce bozulduğunda kullanıcı "yakında market yok" boş ekranını
görür — arıza gürültüsüz olduğu için testler burada koordinat/dedup kenar
durumlarına odaklanıyor.
"""
import pytest

from countries._common.osm_branches import (
    Chain,
    build_overpass_query,
    build_payloads,
    dedupe_new,
    overpass_query,
    run,
)


# --------------------------------------------------------------- sorgu üretimi

def test_query_scopes_to_country_and_matches_brand_not_name():
    q = build_overpass_query("HR", r"Konzum")
    assert '["ISO3166-1"="HR"]' in q
    assert '["brand"~"Konzum",i]' in q
    # `name` regex'i ülke genelinde indekssiz — mirror'ları zaman aşımına
    # düşürüyordu, bu yüzden sorguda YER ALMAMALI.
    assert '["name"' not in q


def test_query_uppercases_iso_code():
    assert '["ISO3166-1"="HU"]' in build_overpass_query("hu", r"Tesco")


def test_query_honors_custom_shop_filter():
    q = build_overpass_query("GR", r"Sklavenitis", shop="supermarket")
    assert '["shop"~"supermarket"]' in q


# ------------------------------------------------------------------- payload'lar

def test_node_payload_carries_coords_and_external_ref():
    els = [{
        "type": "node", "id": 42, "lat": 47.5, "lon": 19.0,
        "tags": {"name": "Tesco Blaha", "addr:city": "Budapest"},
    }]
    assert build_payloads(els, store_id=50) == [{
        "store_id": 50,
        "external_ref": "osm:node/42",
        "name": "Tesco Blaha",
        "lat": 47.5,
        "lon": 19.0,
        "city": "Budapest",
        "source": "osm",
    }]


def test_way_uses_center_centroid():
    els = [{"type": "way", "id": 7, "center": {"lat": 45.8, "lon": 15.9}, "tags": {"brand": "Konzum"}}]
    (p,) = build_payloads(els, store_id=60)
    assert (p["lat"], p["lon"]) == (45.8, 15.9)
    assert p["external_ref"] == "osm:way/7"
    # name yoksa brand'e düşer.
    assert p["name"] == "Konzum"


def test_element_without_coords_is_dropped():
    """Koordinatsız eleman backend Joi doğrulamasını düşürüp 2000 şubelik
    chunk'ın TAMAMINI reddettirebilir — burada elenmeli."""
    els = [{"type": "way", "id": 1, "tags": {"name": "Yok"}}]
    assert build_payloads(els, store_id=50) == []


@pytest.mark.parametrize("lat,lon", [(91.0, 10.0), (-91.0, 10.0), (45.0, 181.0), (45.0, -181.0)])
def test_out_of_range_coords_are_dropped(lat, lon):
    els = [{"type": "node", "id": 1, "lat": lat, "lon": lon, "tags": {}}]
    assert build_payloads(els, store_id=50) == []


def test_non_numeric_coords_are_dropped():
    els = [{"type": "node", "id": 1, "lat": "abc", "lon": "def", "tags": {}}]
    assert build_payloads(els, store_id=50) == []


def test_nameless_element_falls_back_to_type_and_id():
    els = [{"type": "node", "id": 99, "lat": 1.0, "lon": 2.0}]
    (p,) = build_payloads(els, store_id=50)
    assert p["name"] == "node/99"
    assert p["city"] is None


def test_long_name_is_truncated_to_schema_limit():
    els = [{"type": "node", "id": 1, "lat": 1.0, "lon": 2.0, "tags": {"name": "x" * 500}}]
    (p,) = build_payloads(els, store_id=50)
    assert len(p["name"]) == 300


# ----------------------------------------------------------------------- dedup

def test_first_chain_wins_when_two_regexes_match_the_same_object():
    """Aynı OSM nesnesi iki zincirin regex'ine uyabilir (Carrefour /
    CarrefourSA). Aynı external_ref'i iki store_id ile göndermek şubeyi yanlış
    zincire bağlar; ilk zincir kazanmalı."""
    seen: set = set()
    first = dedupe_new([{"external_ref": "osm:node/1", "store_id": 50}], seen)
    second = dedupe_new([{"external_ref": "osm:node/1", "store_id": 51}], seen)
    assert [p["store_id"] for p in first] == [50]
    assert second == []


def test_dedupe_keeps_distinct_refs():
    seen: set = set()
    out = dedupe_new(
        [{"external_ref": "osm:node/1"}, {"external_ref": "osm:node/2"}], seen,
    )
    assert len(out) == 2
    assert seen == {"osm:node/1", "osm:node/2"}


# --------------------------------------------------------------- mirror gezinme

class _Resp:
    def __init__(self, status=200, ctype="application/json", payload=None):
        self.status_code = status
        self.ok = 200 <= status < 300
        self.headers = {"content-type": ctype}
        self._payload = payload or {}
        self.text = ""
        self.content = b"{}"

    def json(self):
        return self._payload


def test_html_error_page_is_not_treated_as_success(monkeypatch):
    """Overpass hız-sınırında JSON yerine HTML döner ve `ok` olabilir. Bunu
    başarı saymak şubeleri sessizce SIFIRLAR."""
    calls = []

    def fake_post(url, **kw):
        calls.append(url)
        if len(calls) <= 3:
            return _Resp(status=200, ctype="text/html")
        return _Resp(payload={"elements": [{"type": "node", "id": 1, "lat": 1.0, "lon": 2.0}]})

    monkeypatch.setattr("countries._common.osm_branches.requests.post", fake_post)
    els = overpass_query("HU", r"Tesco", mirrors=["m1", "m2"], sleep=lambda _s: None)
    # İlk mirror 3 denemede HTML döndü → ikinci mirror'a geçildi ve oradan JSON geldi.
    assert calls[:3] == ["m1", "m1", "m1"]
    assert calls[3] == "m2"
    assert len(els) == 1


def test_all_mirrors_failing_returns_empty_not_exception(monkeypatch):
    monkeypatch.setattr(
        "countries._common.osm_branches.requests.post",
        lambda url, **kw: _Resp(status=429, ctype="text/html"),
    )
    assert overpass_query("HU", r"Tesco", mirrors=["m1"], sleep=lambda _s: None) == []


# ------------------------------------------------------------------ dry-run akışı

def test_dry_run_never_posts_to_backend(monkeypatch):
    monkeypatch.setattr(
        "countries._common.osm_branches.overpass_query",
        lambda *a, **kw: [{"type": "node", "id": 1, "lat": 1.0, "lon": 2.0, "tags": {}}],
    )

    def explode(*a, **kw):
        raise AssertionError("dry-run backend'e YAZMAMALI")

    monkeypatch.setattr("countries._common.osm_branches.ingest_branches", explode)
    stats = run("HU", [Chain(50, "Tesco", r"Tesco")], "http://x", dry_run=True, sleep=lambda _s: None)
    assert stats == {"total": 0, "successful": 0, "failed": 0}
