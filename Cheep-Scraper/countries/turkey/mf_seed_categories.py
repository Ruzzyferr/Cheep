"""
taxonomy.json → backend'e kategori ağacını yükler (POST /categories, ingest-key).
Önce üst kategoriler (parent_id yok), sonra alt kategoriler (parent_id ile).
Çıktı: category_map.json  { "<main_category adı>": <category_id> }  (ingest kullanır)

wipe SQL bunu çağırmadan ÖNCE categories tablosunu boşaltmış olmalı.
"""
import argparse
import io
import json
import os
import sys

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def post_category(api_url, headers, name, slug, order, parent_id=None):
    body = {"name": name, "slug": slug, "display_order": order}
    if parent_id:
        body["parent_id"] = parent_id
    r = requests.post(f"{api_url}/categories", json=body, headers=headers, timeout=30)
    if r.status_code == 409:                       # slug zaten var → mevcut id'yi getir (idempotent)
        g = requests.get(f"{api_url}/categories/slug/{slug}", headers=headers, timeout=30)
        if g.ok:
            d = g.json()
            return (d.get("data") or d).get("id")
    if not r.ok:
        raise RuntimeError(f"POST {name} (slug={slug}): HTTP {r.status_code} {r.text[:200]}")
    data = r.json()
    return (data.get("data") or data).get("id") or data.get("id")


def run(api_url, api_key, taxonomy="taxonomy.json", out="category_map.json"):
    api_url = api_url.rstrip("/")
    headers = {"Content-Type": "application/json", "x-country": "TR"}
    if api_key:
        headers["x-api-key"] = api_key
    tax = json.load(open(taxonomy, encoding="utf-8"))
    slug_to_id = {}
    main_to_id = {}
    n_top = n_sub = 0
    for top in tax["tops"]:
        tid = post_category(api_url, headers, top["name"], top["slug"], top["order"])
        slug_to_id[top["slug"]] = tid
        n_top += 1
        for ch in top["children"]:
            cid = post_category(api_url, headers, ch["name"], ch["slug"], ch["order"], parent_id=tid)
            slug_to_id[ch["slug"]] = cid
            main_to_id[ch["name"]] = cid
            n_sub += 1
        print(f"  {top['name']} (#{tid}) → {len(top['children'])} alt")
    # ATOMIK YAZMA: once .tmp, sonra os.replace.
    #
    # `open(out, "w")` dosyayi YERINDE kirpiyordu. `cheep-fetcher.service`
    # 7/24 calisiyor, bu dosyayi `--category-map` ile izliyor ve mtime
    # degisince YENIDEN OKUYOR. Haftalik taksonomi tazelemesi (Pazar 01:30)
    # tam da o daemon calisirken bu yazmayi yapiyor: daemon yarim yazilmis
    # JSON'a denk gelirse ayristirma patliyor, `_mtime = None` kaliyor ve
    # butun urunler koda gomulu ESKI kategori kimliklerine dusuyordu.
    # os.replace ayni dosya sisteminde atomiktir -- okuyucu ya eski ya yeni
    # dosyanin TAMAMINI gorur, asla yarisini gormez.
    payload = {
        "main_to_id": main_to_id,
        "slug_to_id": slug_to_id,
        "other_id": slug_to_id.get("diger-urunler") or slug_to_id.get("diger"),
    }
    tmp = f"{out}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, out)
    print(f"SEED BİTTİ: üst={n_top} alt={n_sub} → {out}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--taxonomy", default="taxonomy.json")
    ap.add_argument("--out", default="category_map.json")
    a = ap.parse_args()
    run(a.api_url, a.api_key, a.taxonomy, a.out)


if __name__ == "__main__":
    main()
