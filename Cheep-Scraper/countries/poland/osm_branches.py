"""Market SUBE (branch) konumlarini OpenStreetMap'ten (Overpass API) ceker ve
store_branches'e yukler. Ucretsiz, tek kosu, ulke geneli.

external_ref = 'osm:<type>/<id>' (sema zaten OSM icin tasarli). Backend degismez —
mevcut POST /store-branches/bulk-upsert kullanilir. Aylik tekrar calistirilabilir.

Modeled on countries/turkey/osm_branches.py (same mirror list, retry/backoff, chunked
POST) but self-contained — does NOT import from countries.turkey.* — so this module
has no cross-country dependency.

Kullanim (Cheep-Scraper dizininde, venv ile):
  INGEST_API_KEY=... CHEEP_API_URL=https://api.cheep.live/api/v1 \
    python countries/poland/osm_branches.py
"""
import argparse
import logging
import os
import time
from typing import Dict, List, Optional

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("osm_branches_pl")

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# (store_id, etiket, marka/isim regex). Polonya'nin baskin zincirleri.
CHAINS = [
    (44, "Biedronka", r"Biedronka"),
    (45, "Lidl", r"Lidl"),
    (47, "Żabka", r"Żabka|Zabka"),
    (41, "Auchan", r"Auchan"),
    (40, "Carrefour", r"Carrefour"),
]

SHOP = "supermarket|convenience"

BRANCH_CHUNK = 2000  # backend semasi max'i (store-branch.schema.ts)

# Bazi Overpass mirror'lari (ör. overpass-api.de) varsayilan python-requests
# User-Agent'ini HTTP 406 ile reddediyor — tanimli bir UA sart (OSM etigi de bunu ister).
USER_AGENT = "cheep-scraper/1.0 (+https://cheep.live)"


def overpass_query(regex: str):
    # NOT: yalnizca `brand` etiketiyle eslestiriyoruz. `name` regex'i tum ulke
    # uzerinde indekssiz oldugundan sorguyu agirlastirip mirror'lari zaman asimina
    # (HTML hata) dusuruyordu. `brand` indeksli -> hizli ve guvenilir; buyuk PL
    # zincirlerinde brand etiketlemesi guclu (ör. Zabka ~10k sube).
    q = (
        '[out:json][timeout:180];'
        'area["ISO3166-1"="PL"][admin_level=2]->.pl;'
        f'nwr["shop"~"{SHOP}"]["brand"~"{regex}",i](area.pl);'
        'out center tags;'
    )
    # Overpass IP basina slot ile hiz-sinirlar; sik sorguda 429/504 (HTML) doner.
    # Bu yuzden mirror basina birkac deneme + UZUN geri-cekilme (rate-limit dakikalarla
    # acilir). Her mirror'i sirayla dener; JSON gelmezse bekleyip tekrar dener.
    for mirror in OVERPASS_MIRRORS:
        for attempt in range(3):
            try:
                r = requests.post(mirror, data={"data": q}, timeout=210,
                                  headers={"User-Agent": USER_AGENT})
                ctype = r.headers.get("content-type", "")
                if r.ok and ctype.startswith("application/json"):
                    return r.json().get("elements", [])
                logger.warning("mirror %s HTTP %s (%s) — %d. deneme", mirror, r.status_code, ctype[:20], attempt + 1)
            except (requests.RequestException, ValueError) as e:
                logger.warning("mirror %s hata: %s", mirror, str(e)[:80])
            time.sleep(20 * (attempt + 1))   # 20s, 40s, 60s
    logger.error("tum mirror'lar basarisiz (regex=%s)", regex)
    return []


def build_payloads(elements, store_id: int):
    out = []
    for el in elements:
        t, oid = el.get("type"), el.get("id")
        if t == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:  # way / relation -> centroid
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
            "source": "osm",
        })
    return out


def ingest_branches(payloads: List[Dict], api_url: str, api_key: Optional[str]) -> Dict:
    """Subeleri /store-branches/bulk-upsert'e gonderir (self-contained — TR'nin
    ingest_branches'ini import etmez, ayni davranisi burada tekrar eder)."""
    stats = {"total": 0, "successful": 0, "failed": 0}
    if not payloads:
        return stats
    api_url = api_url.rstrip("/")
    headers = {"x-country": "PL", "User-Agent": USER_AGENT}
    key = api_key or os.getenv("INGEST_API_KEY")
    if key:
        headers["x-api-key"] = key
    for i in range(0, len(payloads), BRANCH_CHUNK):
        chunk = payloads[i:i + BRANCH_CHUNK]
        stats["total"] += len(chunk)
        try:
            resp = requests.post(f"{api_url}/store-branches/bulk-upsert",
                                  json={"branches": chunk}, headers=headers, timeout=120)
            if not resp.ok:
                logger.error("branch ingest HTTP %s: %s", resp.status_code, resp.text[:200])
                stats["failed"] += len(chunk)
                continue
            body = resp.json() if resp.content else {}
            ok = body.get("successful", len(chunk))
            stats["successful"] += ok
            stats["failed"] += len(chunk) - ok
        except (requests.RequestException, ValueError) as e:
            logger.error("branch ingest hata: %s", e)
            stats["failed"] += len(chunk)
    return stats


def main():
    ap = argparse.ArgumentParser(description="OSM'den PL market subelerini cek ve yukle")
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
        # Zincir basina HEMEN yukle: ilerleme gorunur olur ve kismi basari korunur
        # (bir zincir mirror'da takilirsa oncekiler zaten kaydedilmis olur).
        if fresh and not a.dry_run:
            st = ingest_branches(fresh, a.api_url, a.api_key)
            for k in grand:
                grand[k] += st[k]
            logger.info("%-12s osm=%d yuklendi=%d (ingest=%s)", label, len(els), len(fresh), st)
        else:
            logger.info("%-12s osm=%d yeni_sube=%d", label, len(els), len(fresh))
        time.sleep(4)

    logger.info("TOPLAM ingest=%s", grand)


if __name__ == "__main__":
    main()
