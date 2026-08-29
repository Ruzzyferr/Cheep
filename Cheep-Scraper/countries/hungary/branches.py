"""MACARİSTAN market şubelerini Árfigyelő'nün kendi API'sinden çeker.

NEDEN OSM DEĞİL: Hırvatistan'da şube koordinatı yok, bu yüzden OpenStreetMap'e
gidiyoruz. Macaristan'da GEREK YOK — GVH'nin `/api/shops` ucu 1.823 mağazayı
RESMÎ zincir kimliğiyle ve enlem/boylamıyla veriyor. Bu, OSM'den iki bakımdan
üstün: (1) mağazalar zincire kesin olarak bağlı (OSM'de `brand` etiketi elle
girildiği için eksik ya da yanlış olabiliyor), (2) kaynak zincirlerin kendi
bildirimine dayanıyor, dolayısıyla açılan/kapanan mağazalar daha hızlı yansıyor.

ZİNCİR EŞLEMESİ ADLA YAPILIYOR, UUID'YLE DEĞİL: `/api/chain-stores` her zincir
için bir UUID veriyor ama UUID'leri koda gömmek kırılgan — kaynak bir zinciri
yeniden kaydederse eşleme sessizce kopar ve o zincirin TÜM şubeleri kaybolur
(uygulamada "yakında market yok" boş ekranı). Ad üzerinden eşlemek hem okunur
hem de bir ad değişikliği koşuda AÇIKÇA uyarı üretir.

BİLİNEN BOŞLUK: yanıttaki `openingTime` alanı HER mağaza için boş — çalışma
saatleri bu kaynaktan gelmiyor.

Kullanım (Cheep-Scraper dizininde, venv ile):
  INGEST_API_KEY=... CHEEP_API_URL=https://api.cheep.live/api/v1 \
    python countries/hungary/branches.py
"""
from __future__ import annotations

import argparse
import logging
import os
from typing import Dict, Iterable, List, Optional

import requests

from countries._common.osm_branches import BRANCH_CHUNK, USER_AGENT, ingest_branches

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("branches_hu")

SHOPS_URL = "https://arfigyelo.gvh.hu/api/shops"
CHAIN_STORES_URL = "https://arfigyelo.gvh.hu/api/chain-stores"

#: Árfigyelő'deki zincir ADI -> `countries/hungary/config.json`'daki store_id.
#: Drogeriler (dm/Rossmann/Müller) config'te KAPALI olduğu için burada da yok:
#: fiyatı olmayan bir zincire şube yazmak, uygulamada ürünsüz market pinleri
#: üretirdi.
CHAIN_STORE_IDS: Dict[str, int] = {
    "Auchan": 60,
    "Tesco": 61,
    "Lidl": 62,
    "Aldi": 63,
    "Penny": 64,
}


def build_chain_index(chain_payload: Dict) -> Dict[str, str]:
    """`{chain_uuid: chain_name}` (SAF)."""
    return {
        str(c["uuid"]): str(c.get("name") or "")
        for c in (chain_payload.get("chainStores") or [])
        if c.get("uuid")
    }


def build_payloads(
    shops_payload: Dict,
    chain_names: Dict[str, str],
    chain_store_ids: Dict[str, int] = CHAIN_STORE_IDS,
) -> List[Dict]:
    """Mağaza kayıtlarını `/store-branches/bulk-upsert` payload'larına çevirir (SAF).

    Koordinatı olmayan ya da eşlenmemiş zincire ait mağazalar DÜŞÜRÜLÜR;
    backend Joi doğrulaması tek bozuk satır yüzünden tüm chunk'ı reddedebilir.
    """
    out: List[Dict] = []
    for shop in shops_payload.get("shops") or []:
        store_id = chain_store_ids.get(chain_names.get(str(shop.get("chainStoreUuid")), ""))
        if store_id is None:
            continue
        location = shop.get("location") or {}
        lat, lon = location.get("latitude"), location.get("longitude")
        if lat is None or lon is None:
            continue
        try:
            latf, lonf = float(lat), float(lon)
        except (TypeError, ValueError):
            continue
        if not (-90 <= latf <= 90) or not (-180 <= lonf <= 180):
            continue
        uuid = str(shop.get("uuid") or "").strip()
        if not uuid:
            continue
        city = (shop.get("city") or "").strip() or None
        address = (shop.get("address") or "").strip()
        out.append({
            "store_id": store_id,
            # Kaynağın kendi kararlı kimliği ("spar-110"). OSM'deki
            # `osm:<type>/<id>` ile aynı rolü oynar ve çakışmaz.
            "external_ref": f"arfigyelo:{uuid}",
            "name": (address or uuid)[:300],
            "lat": latf,
            "lon": lonf,
            "city": city,
            "source": "arfigyelo",
        })
    return out


def _get_json(session: requests.Session, url: str) -> Dict:
    resp = session.get(url, timeout=90, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    ap = argparse.ArgumentParser(description="Árfigyelő'den HU market şubelerini çek ve yükle")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    session = requests.Session()
    chain_names = build_chain_index(_get_json(session, CHAIN_STORES_URL))
    payloads = build_payloads(_get_json(session, SHOPS_URL), chain_names)

    unmapped = sorted(set(chain_names.values()) - set(CHAIN_STORE_IDS))
    if unmapped:
        logger.info("eşlenmeyen zincirler (bilerek atlandı): %s", unmapped)

    by_chain: Dict[int, int] = {}
    for p in payloads:
        by_chain[p["store_id"]] = by_chain.get(p["store_id"], 0) + 1
    logger.info("şube sayıları store_id başına: %s (toplam %d)", by_chain, len(payloads))

    if args.dry_run:
        logger.info("dry-run — backend'e yazılmadı")
        return
    stats = ingest_branches(payloads, args.api_url, args.api_key, "HU")
    logger.info("TOPLAM ingest=%s", stats)


if __name__ == "__main__":
    main()
