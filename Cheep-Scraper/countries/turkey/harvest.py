"""
Full-catalog harvest for Türkiye markets (Migros + ŞOK).

Runs each scraper across ALL categories/terms with many pages, deduped, and
writes timestamped JSON to output/. Human-paced but thorough. Intended to be
run in the background.
"""
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from migros.migros_api_scraper import MigrosAPISafeScraper  # noqa: E402
from sok.sok_scraper import SokScraper  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("harvest")

OUT = Path(__file__).resolve().parent / "output"
OUT.mkdir(exist_ok=True)


def save(store_slug: str, products):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = OUT / f"{store_slug}_products_{ts}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump([p.to_dict() for p in products], f, ensure_ascii=False, indent=2)
    log.info(f"💾 {store_slug}: {len(products)} ürün -> {path.name}")
    return path


def main():
    log.info("=== Migros tam hasat ===")
    mig = MigrosAPISafeScraper(max_pages_per_term=6, delay=0.6)
    mp = mig.fetch_products()
    save("migros", mp)

    log.info("=== ŞOK tam hasat ===")
    sok = SokScraper(max_pages_per_cat=60, delay=0.6)
    sp = sok.fetch_products()
    save("sok", sp)

    log.info(f"=== TOPLAM: Migros={len(mp)}  ŞOK={len(sp)}  =  {len(mp)+len(sp)} ürün ===")


if __name__ == "__main__":
    main()
