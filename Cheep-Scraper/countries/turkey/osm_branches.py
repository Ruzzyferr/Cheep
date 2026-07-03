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
    # Overpass IP başına slot ile hız-sınırlar; sık sorguda 429/504 (HTML) döner.
    # Bu yüzden mirror başına birkaç deneme + UZUN geri-çekilme (rate-limit dakikalarla
    # açılır). Her mirror'ı sırayla dener; JSON gelmezse bekleyip tekrar dener.
    for mirror in OVERPASS_MIRRORS:
        for attempt in range(3):
            try:
                r = requests.post(mirror, data={"data": q}, timeout=210)
                ctype = r.headers.get("content-type", "")
                if r.ok and ctype.startswith("application/json"):
                    return r.json().get("elements", [])
                logger.warning("mirror %s HTTP %s (%s) — %d. deneme", mirror, r.status_code, ctype[:20], attempt + 1)
            except (requests.RequestException, ValueError) as e:
                logger.warning("mirror %s hata: %s", mirror, str(e)[:80])
            time.sleep(20 * (attempt + 1))   # 20s, 40s, 60s
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

    seen = set()
    grand = {"total": 0, "successful": 0, "failed": 0}
    for store_id, label, regex in CHAINS:
        els = overpass_query(regex)
        pays = build_payloads(els, store_id)
        fresh = [p for p in pays if p["external_ref"] not in seen]
        for p in fresh:
            seen.add(p["external_ref"])
        # Zincir başına HEMEN yükle: ilerleme görünür olur ve kısmi başarı korunur
        # (bir zincir mirror'da takılırsa öncekiler zaten kaydedilmiş olur).
        if fresh and not a.dry_run:
            st = ingest_branches(fresh, a.api_url, a.api_key)
            for k in grand:
                grand[k] += st[k]
            logger.info("%-12s osm=%d yüklendi=%d (ingest=%s)", label, len(els), len(fresh), st)
        else:
            logger.info("%-12s osm=%d yeni_şube=%d", label, len(els), len(fresh))
        time.sleep(4)

    logger.info("TOPLAM ingest=%s", grand)


if __name__ == "__main__":
    main()
