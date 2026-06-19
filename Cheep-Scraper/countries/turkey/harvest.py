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


def _harvest(label: str, slug: str, scraper):
    """Run one scraper with isolation: a crash in one market must not abort the
    other, and a zero-product result is surfaced (not silently swallowed)."""
    log.info(f"=== {label} tam hasat ===")
    try:
        products = scraper.fetch_products()
    except Exception as e:  # noqa: BLE001 - isolate per-market failure, but log it
        log.error(f"❌ {label} hasadı başarısız: {e}", exc_info=True)
        return []
    if not products:
        log.warning(f"⚠️  {label}: 0 ürün döndü (kaynak değişmiş veya engellenmiş olabilir)")
    else:
        save(slug, products)
    return products


def main() -> int:
    mp = _harvest("Migros", "migros", MigrosAPISafeScraper(max_pages_per_term=6, delay=0.6))
    sp = _harvest("ŞOK", "sok", SokScraper(max_pages_per_cat=60, delay=0.6))

    log.info(f"=== TOPLAM: Migros={len(mp)}  ŞOK={len(sp)}  =  {len(mp)+len(sp)} ürün ===")
    # Non-zero exit if BOTH markets yielded nothing — so a silent total failure is
    # visible to any caller / scheduler.
    if not mp and not sp:
        log.error("❌ Hiçbir markettan ürün alınamadı.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
