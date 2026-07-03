"""Tek seferlik ŞUBE backfill — daemon'un kaydettiği ham ürün JSON'larından
(mf_raw/*.json) şubeleri çıkarıp store_branches'e yükler. Devlet API'sine dokunmaz;
mevcut veriden çalışır. Daemon zaten süregelen taramada şubeleri günceller — bu script
yalnızca "her şey taze" olduğunda tabloyu hemen doldurmak içindir.

Kullanım (Cheep-Scraper dizininde, venv ile):
  INGEST_API_KEY=... CHEEP_API_URL=http://localhost:3000/api/v1 \
    python countries/turkey/branch_backfill.py mf_raw
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from countries.turkey.marketfiyati import build_branch_payloads, ingest_branches  # noqa: E402


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else "mf_raw"
    api = os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1")
    key = os.getenv("INGEST_API_KEY")

    files = glob.glob(os.path.join(raw, "*.json"))
    products = {}
    for fp in files:
        try:
            d = json.load(open(fp, encoding="utf-8"))
        except Exception:
            continue
        pid = str(d.get("id") or os.path.splitext(os.path.basename(fp))[0])
        products[pid] = d

    seen = set()
    payloads = build_branch_payloads(products, seen)
    print(f"raw_files={len(files)} products={len(products)} unique_branches={len(payloads)}", flush=True)
    st = ingest_branches(payloads, api, key)
    print("ingest:", st, flush=True)


if __name__ == "__main__":
    main()
