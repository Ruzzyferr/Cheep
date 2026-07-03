"""Market ŞUBE konumlarını Geofabrik Türkiye OSM ekstresinden (.osm.pbf) çıkarır ve
store_branches'e yükler. Overpass'in aksine hız-sınırı/timeout yok — TEK dosya, TAM,
güvenilir. Aylık tekrar çalıştırılabilir (yeni pbf indir + çalıştır).

Kullanım (Cheep-Scraper dizininde, venv ile):
  INGEST_API_KEY=... CHEEP_API_URL=http://localhost:3000/api/v1 \
    python countries/turkey/osm_pbf_branches.py /tmp/turkey.osm.pbf
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys

import osmium

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from countries.turkey.marketfiyati import ingest_branches  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("osm_pbf")

SHOP_OK = {"supermarket", "convenience", "department_store"}

# (regex, store_id) — marka/isim eşleşmesi. Türkiye'nin baskın zincirleri.
BRANDS = [
    (re.compile(r"BİM|BIM", re.I), 5),
    (re.compile(r"A[\s-]?101", re.I), 3),
    (re.compile(r"Migros|Mjet|Macrocenter", re.I), 1),
    (re.compile(r"Şok|ŞOK", re.I), 4),
    (re.compile(r"Carrefour", re.I), 2),
    (re.compile(r"Tarım Kredi|Tarim Kredi", re.I), 6),
    (re.compile(r"Hakmar", re.I), 7),
]


def classify(tags) -> int | None:
    val = (tags.get("brand") or tags.get("name") or "")
    for rx, sid in BRANDS:
        if rx.search(val):
            return sid
    return None


class BranchHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.out = []
        self.seen = set()

    def _add(self, osm_type, osm_id, tags, lat, lon):
        if tags.get("shop") not in SHOP_OK:
            return
        sid = classify(tags)
        if sid is None:
            return
        ref = f"osm:{osm_type}/{osm_id}"
        if ref in self.seen:
            return
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return
        self.seen.add(ref)
        name = (tags.get("name") or tags.get("brand") or f"{osm_type}/{osm_id}")[:300]
        self.out.append({
            "store_id": sid,
            "external_ref": ref,
            "name": name,
            "lat": lat,
            "lon": lon,
            "city": tags.get("addr:city") or None,
        })

    def node(self, n):
        if n.location.valid():
            self._add("node", n.id, n.tags, n.location.lat, n.location.lon)

    def way(self, w):
        lats, lons = [], []
        for c in w.nodes:
            try:
                if c.location.valid():
                    lats.append(c.location.lat)
                    lons.append(c.location.lon)
            except osmium.InvalidLocationError:
                continue
        if lats:
            self._add("way", w.id, w.tags, sum(lats) / len(lats), sum(lons) / len(lons))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pbf")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--dry-run", action="store_true")
    # Düğüm-noktası (node) marketleri düşük bellekle çeker. --ways ile way/bina
    # poligonları da dahil edilir; bunun için düğüm konum indeksi gerekir ki 1.9GB
    # RAM'e sığmaz → DİSK tabanlı indeks (sparse_file_array) kullanılır.
    ap.add_argument("--ways", action="store_true", help="way/bina poligonlarını da dahil et (disk indeksi)")
    a = ap.parse_args()

    h = BranchHandler()
    logger.info("PBF taranıyor: %s (ways=%s)", a.pbf, a.ways)
    if a.ways:
        h.apply_file(a.pbf, locations=True, idx="sparse_file_array,/tmp/osm_loc.idx")
    else:
        h.apply_file(a.pbf)   # yalnızca node'lar — indekssiz, hızlı, düşük bellek
    logger.info("bulunan şube=%d", len(h.out))

    # zincir dağılımı
    dist = {}
    for b in h.out:
        dist[b["store_id"]] = dist.get(b["store_id"], 0) + 1
    logger.info("store_id dağılımı: %s", dict(sorted(dist.items())))

    if a.dry_run:
        logger.info("dry-run — ingest atlandı")
        return
    st = ingest_branches(h.out, a.api_url, a.api_key)
    logger.info("INGEST: %s", st)


if __name__ == "__main__":
    main()
