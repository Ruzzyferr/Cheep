"""Market ŞUBE konumlarını OpenStreetMap'ten (Overpass API) çeker ve store_branches'e
yükler. Ücretsiz, tek koşu, ülke geneli. Devlet API'si konumdan bağımsız tek depo
döndürdüğü için (yalnız ~23 İstanbul şubesi) mesafe için asıl kaynak budur.

external_ref = 'osm:<type>/<id>' (şema zaten OSM için tasarlı). Backend değişmez —
mevcut POST /store-branches/bulk-upsert kullanılır. Aylık tekrar çalıştırılabilir.

Kullanım (Cheep-Scraper dizininde, venv ile):
  INGEST_API_KEY=... CHEEP_API_URL=https://api.cheep.live/api/v1 \
    python countries/turkey/osm_branches.py
"""
import argparse
import logging
import os
import sys
import time

import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from countries.turkey.marketfiyati import ingest_branches  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("osm_branches")

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# (store_id, etiket, marka/isim regex). Türkiye'nin baskın zincirleri.
CHAINS = [
    (5, "BİM", r"BİM|BIM"),
    (3, "A101", r"A101|A-101"),
    (1, "Migros", r"Migros|MİGROS|Mjet|MJET|Macrocenter|Migros Jet"),
    (4, "ŞOK", r"Şok|ŞOK|Sok Market"),
    (2, "CarrefourSA", r"CarrefourSA|Carrefour"),
    (6, "Tarım Kredi", r"Tarım Kredi|Tarim Kredi"),
    (7, "Hakmar", r"Hakmar"),
]

SHOP = "supermarket|convenience|department_store"


def overpass_query(regex: str):
    # NOT: yalnızca `brand` etiketiyle eşleştiriyoruz. `name` regex'i tüm ülke
    # üzerinde indekssiz olduğundan sorguyu ağırlaştırıp mirror'ları zaman aşımına
    # (HTML hata) düşürüyordu. `brand` indeksli → hızlı ve güvenilir; büyük TR
    # zincirlerinde brand etiketlemesi güçlü (ör. A101 ~2900 şube).
    q = (
        '[out:json][timeout:180];'
        'area["ISO3166-1"="TR"][admin_level=2]->.tr;'
        f'nwr["shop"~"{SHOP}"]["brand"~"{regex}",i](area.tr);'
        'out center tags;'
    )
    for mirror in OVERPASS_MIRRORS:
        for attempt in range(2):
            try:
                r = requests.post(mirror, data={"data": q}, timeout=210)
                ctype = r.headers.get("content-type", "")
                if r.ok and ctype.startswith("application/json"):
                    return r.json().get("elements", [])
                logger.warning("mirror %s HTTP %s (%s)", mirror, r.status_code, ctype[:30])
            except (requests.RequestException, ValueError) as e:
                logger.warning("mirror %s hata: %s", mirror, e)
            time.sleep(6)
    logger.error("tüm mirror'lar başarısız (regex=%s)", regex)
    return []


def build_payloads(elements, store_id: int):
    out = []
    for el in elements:
        t, oid = el.get("type"), el.get("id")
        if t == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:  # way / relation → centroid
            c = el.get("center") or {}
            lat, lon = c.get("lat"), c.get("lon")
        if lat is None or lon is None:
            continue
        try:
            latf, lonf = float(lat), float(lon)
        except (TypeError, ValueError):
            continue
        if not (-90 <= latf <= 90) or not (-180 <= lonf <= 180):
            continue
        tags = el.get("tags") or {}
        name = (tags.get("name") or tags.get("brand") or f"{t}/{oid}")[:300]
        out.append({
            "store_id": store_id,
            "external_ref": f"osm:{t}/{oid}",
            "name": name,
            "lat": latf,
            "lon": lonf,
            "city": (tags.get("addr:city") or None),
        })
    return out


def main():
    ap = argparse.ArgumentParser(description="OSM'den market şubelerini çek ve yükle")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    all_payloads = []
    seen = set()
    for store_id, label, regex in CHAINS:
        els = overpass_query(regex)
        pays = build_payloads(els, store_id)
        fresh = [p for p in pays if p["external_ref"] not in seen]
        for p in fresh:
            seen.add(p["external_ref"])
        logger.info("%-12s osm=%d yeni_şube=%d", label, len(els), len(fresh))
        all_payloads.extend(fresh)
        time.sleep(4)

    logger.info("TOPLAM şube=%d", len(all_payloads))
    if a.dry_run:
        logger.info("dry-run — ingest atlandı")
        return
    st = ingest_branches(all_payloads, a.api_url, a.api_key)
    logger.info("INGEST: %s", st)


if __name__ == "__main__":
    main()
