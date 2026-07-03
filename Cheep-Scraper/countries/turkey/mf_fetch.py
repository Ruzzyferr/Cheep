"""
Phase A — TAM FETCH (ham veriyi diske kaydet). API'ye SADECE burada dokunulur.

Devletin (marketfiyati) sitemap'indeki HER ürün ID'si (~33.433) kesin bir duruma
ulaşana kadar çekilir:
  - RESOLVED  → ham JSON `raw_dir/<id>.json` olarak kaydedilir
  - EMPTY     → HTTP 200 + boş içerik (gerçekten yok) → empty_file'a yazılır
  - blok/hata → terminal DEĞİL; sonraki geçişte tekrar denenir
Döngü, aralıktaki her ID ya RESOLVED ya EMPTY olana kadar sürer. Sonda tamlık
değişmezi (raw ∪ empty == aralık) doğrulanır → "hepsini aldığımızın" ispatı.

İngest YOK. Bu faz bittikten sonra mf_ingest.py ham veriden localde işler.
"""
import argparse
import io
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from countries.turkey.marketfiyati import (
    _session, fetch_all_ids, fetch_product, health_ok, EMPTY,
    WORKERS, CHUNK, BLOCK_WAIT, MAX_PASSES,
)

logger = logging.getLogger("mf_fetch")


def _load_lines(path):
    if not path or not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as f:
        return set(l.strip() for l in f if l.strip())


def fetch_range(raw_dir, empty_file, start=0, end=0, passes=MAX_PASSES, verify_empties=True):
    os.makedirs(raw_dir, exist_ok=True)
    session = _session()
    all_ids = fetch_all_ids(session)
    ids = all_ids[start:(end or len(all_ids))]
    target = set(ids)
    logger.info("ARALIK: [%d:%d] → %d id (toplam sitemap=%d)", start, end or len(all_ids), len(ids), len(all_ids))

    have_raw = {fn[:-5] for fn in os.listdir(raw_dir) if fn.endswith(".json")} & target
    empty = _load_lines(empty_file) & target
    empty_fp = open(empty_file, "a", encoding="utf-8")
    logger.info("başlangıç: raw=%d empty=%d kalan=%d", len(have_raw), len(empty), len(ids) - len(have_raw) - len(empty))

    for pas in range(1, passes + 1):
        todo = [i for i in ids if i not in have_raw and i not in empty]
        if not todo:
            break
        logger.info("=== GEÇİŞ %d — kalan=%d (raw=%d empty=%d) ===", pas, len(todo), len(have_raw), len(empty))
        for c in range(0, len(todo), CHUNK):
            chunk = todo[c:c + CHUNK]
            waited = 0
            while not health_ok(session):
                waited += 1
                logger.info("API bloklu — %ds bekleniyor (chunk %d/%d, geçiş %d)",
                            BLOCK_WAIT, c // CHUNK + 1, (len(todo) + CHUNK - 1) // CHUNK, pas)
                time.sleep(BLOCK_WAIT)
                if waited >= 20:
                    logger.warning("uzun blok — chunk atlanıyor, sonraki geçişte tekrar"); break
            with ThreadPoolExecutor(max_workers=WORKERS) as ex:
                futs = {ex.submit(fetch_product, session, pid): pid for pid in chunk}
                for fut in as_completed(futs):
                    pid = futs[fut]
                    res = fut.result()
                    if res is None:
                        continue                       # blok/hata → sonraki geçiş
                    if res is EMPTY:
                        empty.add(pid); empty_fp.write(pid + "\n")
                    else:
                        with open(os.path.join(raw_dir, f"{pid}.json"), "w", encoding="utf-8") as f:
                            json.dump(res, f, ensure_ascii=False)
                        have_raw.add(pid)
            empty_fp.flush()
            if (c // CHUNK) % 5 == 0:
                logger.info("ilerleme: raw=%d empty=%d / %d", len(have_raw), len(empty), len(ids))

    # tamlık: her ID ya raw ya empty mi?
    remaining = [i for i in ids if i not in have_raw and i not in empty]
    logger.info("FETCH SONU (geçişler): raw=%d empty=%d kalan-blok=%d / hedef=%d",
                len(have_raw), len(empty), len(remaining), len(ids))

    # EMPTY doğrulama: gerçekten boş mu (gizli blok değil mi)? bir geçiş daha.
    if verify_empties and empty:
        logger.info("EMPTY doğrulama: %d id yeniden kontrol ediliyor...", len(empty))
        moved = 0
        for pid in list(empty):
            if health_ok(session):
                res = fetch_product(session, pid)
                if res is not None and res is not EMPTY:
                    with open(os.path.join(raw_dir, f"{pid}.json"), "w", encoding="utf-8") as f:
                        json.dump(res, f, ensure_ascii=False)
                    have_raw.add(pid); empty.discard(pid); moved += 1
        logger.info("EMPTY doğrulama bitti: %d id aslında ürünmüş (raw'a taşındı)", moved)

    empty_fp.close()
    done = len(have_raw) + len(empty)
    logger.info("TAMLIK: raw=%d + empty=%d = %d / hedef=%d %s",
                len(have_raw), len(empty), done, len(ids),
                "✓ TAM" if done >= len(ids) else f"✗ EKSİK={len(ids)-done}")
    return {"raw": len(have_raw), "empty": len(empty), "remaining": len(ids) - done}


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="marketfiyati TAM fetch → ham JSON")
    ap.add_argument("--raw-dir", default="mf_raw")
    ap.add_argument("--empty-file", default="mf_empty.txt")
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--end", type=int, default=0)
    ap.add_argument("--passes", type=int, default=MAX_PASSES)
    ap.add_argument("--no-verify-empties", action="store_true")
    a = ap.parse_args()
    fetch_range(a.raw_dir, a.empty_file, a.start, a.end, a.passes, not a.no_verify_empties)


if __name__ == "__main__":
    main()
