"""Macaristan ve Romanya şube ithalatçılarının saf fonksiyonları.

Şube verisi sessizce bozulduğunda kullanıcı "yakında market yok" boş ekranını
görür — hata yok, sadece sonuç yok. Testler bu yüzden koordinat/eşleme/şehir
kenar durumlarına odaklanıyor.
"""
import pytest

from countries.hungary.branches import (
    build_chain_index,
    build_payloads as hu_payloads,
)
from countries.romania.branches import (
    grid_points,
    normalize_city,
    parse_stores as ro_stores,
)


# ============================================================== MACARİSTAN

HU_CHAINS = {"chainStores": [
    {"uuid": "u-tesco", "name": "Tesco"},
    {"uuid": "u-spar", "name": "Spar"},
]}


def test_chain_index_maps_uuid_to_name():
    assert build_chain_index(HU_CHAINS) == {"u-tesco": "Tesco", "u-spar": "Spar"}


def test_hungary_store_becomes_a_branch_payload():
    payload = {"shops": [{
        "uuid": "tesco-12", "city": "Budapest", "address": "Fő utca 1",
        "chainStoreUuid": "u-tesco",
        "location": {"latitude": 47.5, "longitude": 19.0},
    }]}
    (p,) = hu_payloads(payload, build_chain_index(HU_CHAINS))
    assert p == {
        "store_id": 61, "external_ref": "arfigyelo:tesco-12", "name": "Fő utca 1",
        "lat": 47.5, "lon": 19.0, "city": "Budapest", "source": "arfigyelo",
    }


def test_unmapped_chain_is_skipped():
    """SPAR sisteme kayıtlı ama HİÇ fiyat bildirmiyor ve config'te kapalı.
    Fiyatı olmayan zincire şube yazmak, uygulamada ÜRÜNSÜZ market pinleri
    üretir — kullanıcı markete gider, uygulamada tek fiyat yoktur."""
    payload = {"shops": [{
        "uuid": "spar-1", "chainStoreUuid": "u-spar",
        "location": {"latitude": 47.5, "longitude": 19.0},
    }]}
    assert hu_payloads(payload, build_chain_index(HU_CHAINS)) == []


@pytest.mark.parametrize("location", [
    {}, {"latitude": None, "longitude": 19.0}, {"latitude": "abc", "longitude": "d"},
    {"latitude": 95.0, "longitude": 19.0}, {"latitude": 47.5, "longitude": 200.0},
])
def test_hungary_bad_coordinates_are_dropped(location):
    payload = {"shops": [{"uuid": "tesco-1", "chainStoreUuid": "u-tesco", "location": location}]}
    assert hu_payloads(payload, build_chain_index(HU_CHAINS)) == []


def test_hungary_falls_back_to_uuid_when_address_missing():
    payload = {"shops": [{
        "uuid": "tesco-9", "chainStoreUuid": "u-tesco",
        "location": {"latitude": 47.5, "longitude": 19.0},
    }]}
    (p,) = hu_payloads(payload, build_chain_index(HU_CHAINS))
    assert p["name"] == "tesco-9"
    assert p["city"] is None


# ================================================================= ROMANYA

def _ro_payload(**addr_extra):
    addr = {"addrstring": "Calea Vacaresti NR. 391", "uatid": "179132",
            "location": {"Lat": 44.39, "Lon": 26.12}}
    addr.update(addr_extra)
    return {"Items": [{
        "id": "2508", "name": "AUCHAN COTROCENI",
        "retailnetwork": {"id": "AUCHAN"}, "addr": addr,
    }]}


def test_romania_store_becomes_a_branch_payload():
    (p,) = ro_stores(_ro_payload(), uat_index={"179132": "București"})
    assert p["store_id"] == 70
    assert p["external_ref"] == "monitorul:2508"
    assert (p["lat"], p["lon"]) == (44.39, 26.12)
    assert p["city"] == "București"


def test_romania_unknown_locality_leaves_city_empty_not_wrong():
    """Bilinmeyen yerleşim ŞEHİRSİZ kalır — mağaza yine kaydedilir, yalnızca
    SEO şehir sayfasına girmez. Yanlış şehir yazmaktansa boş bırakmak doğru."""
    (p,) = ro_stores(_ro_payload(uatid="999999"), uat_index={"179132": "București"})
    assert p["city"] is None


def test_romania_disabled_chain_is_skipped():
    """Cora/Profi/Supeco config'te KAPALI (bayat veri / sığ katalog)."""
    payload = _ro_payload()
    payload["Items"][0]["retailnetwork"] = {"id": "5948914999995"}   # CORA
    assert ro_stores(payload) == []


def test_romania_missing_coordinates_are_dropped():
    payload = _ro_payload()
    payload["Items"][0]["addr"]["location"] = {}
    assert ro_stores(payload) == []


# ------------------------------------------------------- şehir normalleştirme

@pytest.mark.parametrize("raw,expected", [
    ("Municipiul Bucureşti, Bucuresti", "București"),
    ("Municipiul Timişoara, Timiş", "Timișoara"),
    ("Municipiul Cluj-Napoca, Cluj", "Cluj-Napoca"),
    ("Oraşul Voluntari, Ilfov", "Voluntari"),
    ("Comuna Florești, Cluj", "Florești"),
])
def test_city_names_are_normalized_to_comma_below(raw, expected):
    """Kaynak ESKİ sedil biçimini kullanıyor (ş/ţ, U+015F/U+0163); Romence'nin
    doğru yazımı virgül-altı (ș/ț). Normalleştirilmezse aynı şehir İKİ ayrı
    SEO sayfası üretir ve ikisi de birbiriyle yarışır."""
    assert normalize_city(raw) == expected
    assert "ş" not in normalize_city(raw) and "ţ" not in normalize_city(raw)


def test_city_normalizer_survives_empty_input():
    assert normalize_city("") == ""
    assert normalize_city(None) == ""


# --------------------------------------------------------------- ızgara

def test_grid_covers_the_bounding_box_including_the_far_edges():
    """REGRESYON: `lon += step` kayan nokta biriktirip son sütunu düşürüyordu
    (26.0 + 0.1×2 = 26.200000000000003 > 26.2), yani ızgaranın DOĞU KENARI hiç
    taranmıyor ve oradaki mağazalar sessizce keşfedilmiyordu."""
    points = grid_points((44.0, 26.0, 44.2, 26.2), 0.1)
    assert len(points) == 9, points          # 3x3, kenarlar dahil
    assert (44.0, 26.0) in points            # güney-batı köşesi
    assert (44.2, 26.2) in points            # kuzey-doğu köşesi (düşen buydu)


def test_grid_step_controls_density():
    coarse = grid_points((44.0, 26.0, 45.0, 27.0), 0.5)
    fine = grid_points((44.0, 26.0, 45.0, 27.0), 0.25)
    assert len(fine) > len(coarse)
