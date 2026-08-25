# -*- coding: utf-8 -*-
"""
Paylasilan yeniden deneme yardimcisi.

PL scraper'larinin hicbirinde yeniden deneme/geri cekilme/429 isleme yoktu;
her 2xx-disi yanit WARNING'e donusup crawler ayni hizla devam ediyordu. Wolt
~120. kategoriden sonra 429 vermeye baslarsa tarama kataloğun %40'iyla bitiyor,
kismi veri ice aktariliyor, kosum `successful` raporluyor ve prune tetikleniyor.
"""
import pytest

from countries._common.http_retry import (
    RETRYABLE_STATUS, retry_after_seconds, with_retry,
)


class SahteHata(Exception):
    def __init__(self, status=None, headers=None):
        super().__init__(f"status={status}")
        self.status = status
        self.headers = headers


def _status(e):
    return getattr(e, "status", None)


def _headers(e):
    return getattr(e, "headers", None)


def test_basarili_cagri_hic_beklemez():
    assert with_retry(lambda: "ok", aciklama="t") == "ok"


def test_gecici_hata_sonra_basari(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda *_: None)
    durumlar = [SahteHata(503), None]

    def fn():
        d = durumlar.pop(0)
        if d:
            raise d
        return "ok"

    assert with_retry(fn, taban_gecikme=0, aciklama="t", status_of=_status) == "ok"


def test_kalici_hata_ANINDA_firlatilir(monkeypatch):
    """404 tekrar denemekle duzelmez; kaynagi bosuna dovmemeli."""
    monkeypatch.setattr("time.sleep", lambda *_: None)
    cagri = {"n": 0}

    def fn():
        cagri["n"] += 1
        raise SahteHata(404)

    with pytest.raises(SahteHata):
        with_retry(fn, max_denemeler=3, taban_gecikme=0, aciklama="t", status_of=_status)
    assert cagri["n"] == 1, "404 yeniden denenmemeli"


def test_denemeler_tukenince_SON_HATA_firlatilir(monkeypatch):
    """Sessizce None donmek cagirani 'veri yok' sanmaya iter — prune zinciri."""
    monkeypatch.setattr("time.sleep", lambda *_: None)
    cagri = {"n": 0}

    def fn():
        cagri["n"] += 1
        raise SahteHata(503)

    with pytest.raises(SahteHata):
        with_retry(fn, max_denemeler=3, taban_gecikme=0, aciklama="t", status_of=_status)
    assert cagri["n"] == 3


def test_429_retry_after_basligina_uyar():
    assert retry_after_seconds({"Retry-After": "7"}, 99) == 7.0
    assert retry_after_seconds({"retry-after": "2.5"}, 99) == 2.5


def test_retry_after_absurt_degeri_tavanlar():
    assert retry_after_seconds({"Retry-After": "99999"}, 1) == 120.0


def test_retry_after_bicimsizse_varsayilan():
    assert retry_after_seconds({"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"}, 3.0) == 3.0
    assert retry_after_seconds(None, 3.0) == 3.0


def test_429_yeniden_denenebilir_kabul_edilir():
    assert 429 in RETRYABLE_STATUS
    assert 404 not in RETRYABLE_STATUS
    assert 400 not in RETRYABLE_STATUS
