"""
Phase B — INGEST (localde, API'ye dokunmadan tekrar tekrar çalıştırılabilir).

mf_raw/*.json + category_map.json → payload (6 zincir, min fiyat, ean=mf-<id>,
GÖRSEL YOK, category_id = main_category → seed'lenmiş alt-kategori id) → bulk-upsert.

Kategori/mapping düzeltmek için API'ye (devlete) hiç dokunmadan yeniden çalıştırılır.
"""
import argparse
import io
import json
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from countries.turkey.marketfiyati import build_price_payloads, ingest

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("mf_ingest")


def run(raw_dir, api_url, api_key, category_map="category_map.json",
        batch=1500, dry_run=False):
    cm = json.load(open(category_map, encoding="utf-8"))
    main_to_id = cm["main_to_id"]
    other_id = cm.get("other_id")
    files = [f for f in os.listdir(raw_dir) if f.endswith(".json")]
    logger.info("raw ürün=%d, kategori eşleme=%d (other=%s)", len(files), len(main_to_id), other_id)

    grand = {"total": 0, "successful": 0, "failed": 0}
    n_prod = miss_cat = 0
    buf = {}
    def flush():
        nonlocal buf, grand
        if not buf:
            return
        payloads = build_price_payloads(buf)
        if not dry_run and payloads:
            st = ingest(payloads, api_url, api_key)
            for k in grand:
                grand[k] += st[k]
        logger.info("ingest: ürün=%d payload=%d | toplam ürün=%d", len(buf), len(payloads), n_prod)
        buf = {}

    for fn in files:
        try:
            d = json.load(open(os.path.join(raw_dir, fn), encoding="utf-8"))
        except Exception:
            continue
        pid = str(d.get("id") or fn[:-5])
        main = (d.get("main_category") or "").strip()
        cat = main_to_id.get(main, other_id)
        if main not in main_to_id:
            miss_cat += 1
        d["_cheep_cat"] = cat
        buf[pid] = d
        n_prod += 1
        if len(buf) >= batch:
            flush()
    flush()
    logger.info("BİTTİ: ürün=%d, kategori-eşleşmeyen(→other)=%d, INGEST=%s", n_prod, miss_cat, grand)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", default="mf_raw")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--category-map", default="category_map.json")
    ap.add_argument("--batch", type=int, default=1500)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    run(a.raw_dir, a.api_url, a.api_key, a.category_map, a.batch, a.dry_run)


if __name__ == "__main__":
    main()
