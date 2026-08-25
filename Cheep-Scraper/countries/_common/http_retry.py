# -*- coding: utf-8 -*-
"""
Paylasilan HTTP yeniden deneme / geri cekilme yardimcisi.

NEDEN VAR: Polonya scraper'larinin HICBIRINDE yeniden deneme, geri cekilme ya
da 429 isleme yoktu. Her 2xx-disi yanit bir seviye yukarida yakalanip WARNING
olarak kaydediliyor ve crawler ayni sabit hizla bir sonraki kategoriye
geciyordu.

Somut sonuc: Wolt, Carrefour'un 319 leaf kategorisinin ~120'sinden sonra 429
vermeye baslarsa tarama dakikalar icinde kataloğun %40'iyla bitiyor, o kismi
veri ice aktariliyor, kosum `successful` raporluyor ve exit 0 donuyor --
ardindan prune tetikleniyor. Sayim-cokusu kapisi bile %40'lik kaybi
yakalayamiyor.

`base_scraper.py` zaten `max_retries = 3` tanimliyordu ama HICBIR PL scraper'i
onu kullanmiyordu; dogru geri cekilme mantigi da depoda vardi
(`poland/osm_branches.py`, `turkey/mf_daemon.py`) ama paylasilmiyordu. Bu
modul o mantigi tek yere topluyor.
"""
from __future__ import annotations

import logging
import random
import time
from typing import Callable, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

#: Yeniden denenebilir HTTP durum kodlari. 4xx'ler BILEREK disarida:
#: 404/400 tekrar denemekle duzelmez, yalnizca kaynagi bosuna dover.
RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})


def retry_after_seconds(headers, varsayilan: float) -> float:
    """`Retry-After` basligini saniyeye cevirir (yalnizca saniye bicimi).

    Sunucu ne kadar bekleyecegimizi SOYLUYORSA ona uymak, kendi tahminimizi
    dayatmaktan hem daha nazik hem daha hizli iyilesir.
    """
    if not headers:
        return varsayilan
    ham = headers.get("Retry-After") or headers.get("retry-after")
    if not ham:
        return varsayilan
    try:
        sn = float(str(ham).strip())
    except (TypeError, ValueError):
        return varsayilan
    # Absurt degerlere karsi tavan: bir tarama saatlerce beklememeli.
    return max(0.0, min(sn, 120.0))


def with_retry(
    fn: Callable[[], T],
    *,
    max_denemeler: int = 3,
    taban_gecikme: float = 1.5,
    aciklama: str = "istek",
    status_of: Optional[Callable[[BaseException], Optional[int]]] = None,
    headers_of: Optional[Callable[[BaseException], Optional[dict]]] = None,
) -> T:
    """`fn`i cagirir; yeniden denenebilir hatalarda ussel geri cekilmeyle tekrarlar.

    - Ussel + JITTER: sabit gecikme, ayni anda dusen butun istekleri ayni anda
      geri getirip ikinci bir dalga uretir ("thundering herd").
    - Yalnizca RETRYABLE_STATUS ve aglatma hatalari tekrarlanir; 404 gibi
      kalici hatalar ANINDA firlatilir.
    - Tum denemeler tukenirse SON hata firlatilir — sessizce None donmek,
      cagirani "veri yok" sanmaya iter ve tam olarak prune zincirini besler.
    """
    son_hata: Optional[BaseException] = None
    for deneme in range(1, max_denemeler + 1):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 - siniflandirmayi asagida yapiyoruz
            son_hata = e
            durum = status_of(e) if status_of else None

            # Kalici hata: tekrar denemenin anlami yok.
            if durum is not None and durum not in RETRYABLE_STATUS:
                raise

            if deneme == max_denemeler:
                break

            gecikme = taban_gecikme * (2 ** (deneme - 1))
            gecikme += random.uniform(0, taban_gecikme)  # jitter
            if durum == 429 and headers_of:
                gecikme = retry_after_seconds(headers_of(e), gecikme)

            logger.warning(
                "%s basarisiz (deneme %d/%d, durum=%s): %s — %.1f sn sonra tekrar",
                aciklama, deneme, max_denemeler, durum, e, gecikme,
            )
            time.sleep(gecikme)

    assert son_hata is not None
    raise son_hata


def requests_status(e: BaseException) -> Optional[int]:
    """`requests.HTTPError` icinden durum kodunu cikarir (yoksa None)."""
    resp = getattr(e, "response", None)
    return getattr(resp, "status_code", None) if resp is not None else None


def requests_headers(e: BaseException) -> Optional[dict]:
    """`requests.HTTPError` icinden yanit basliklarini cikarir."""
    resp = getattr(e, "response", None)
    return getattr(resp, "headers", None) if resp is not None else None
