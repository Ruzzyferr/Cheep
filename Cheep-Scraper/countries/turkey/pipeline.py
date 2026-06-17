"""
Türkiye weekly pipeline: scrape ALL markets -> classify -> cross-market match.

This is the single command the weekly scheduler runs (Sunday nights when the
backend is on a server). Steps:
  1. Scrape every enabled market (Migros, ŞOK = requests; A101 = Playwright).
  2. Classify each product into the canonical taxonomy (name-first).
  3. Group equivalent products across markets (same name+gramaj -> one product).
  4. Write a matched dataset (output/matched_{ts}.json): one canonical product per
     group with its per-market prices — exactly what the UI needs (one card; per
     market prices on detail / list price-calc).

Run manually:  python countries/turkey/pipeline.py
Ingest to DB:  add --ingest (posts to backend bulk-upsert; see Faz 3).
"""
import sys
import json
import argparse
import logging
import collections
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from migros.migros_api_scraper import MigrosAPISafeScraper  # noqa: E402
from sok.sok_scraper import SokScraper  # noqa: E402
from a101.a101_scraper import A101Scraper  # noqa: E402
from carrefour.carrefour_scraper import CarrefourScraper  # noqa: E402
from util.taxonomy import classify  # noqa: E402
from scrapers.matching import group_products, _size_key  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("pipeline")

OUT = Path(__file__).resolve().parent / "output"
OUT.mkdir(exist_ok=True)

STORE_IDS = {"Migros": 1, "CarrefourSA": 2, "A101": 3, "BİM": 4, "ŞOK": 5}


def scrape_all() -> list:
    products = []
    log.info("--- Migros ---")
    products += MigrosAPISafeScraper(max_pages_per_term=6, delay=0.6).fetch_products()
    log.info("--- ŞOK ---")
    products += SokScraper(max_pages_per_cat=60, delay=0.6).fetch_products()
    log.info("--- CarrefourSA ---")
    products += CarrefourScraper(max_pages_per_cat=50, delay=0.6).fetch_products()
    log.info("--- A101 ---")
    products += A101Scraper(headless=True, delay=1.0).fetch_products()
    log.info(f"scraped total: {len(products)}")
    return products


def build_catalog(products: list) -> list:
    """Classify + cross-market group -> canonical catalog with per-market prices."""
    # attach canonical category
    for p in products:
        p.category = None
        top, sub = classify(p.name, p.raw_category)
        setattr(p, "_top", top)
        setattr(p, "_sub", sub)
        p.category = f"{top} > {sub}"

    # group within (top, canonical-size) buckets — faster and never crosses size
    buckets = collections.defaultdict(list)
    for p in products:
        buckets[(p._top, _size_key(p.quantity, p.unit))].append(p)

    catalog = []
    for _, group_items in buckets.items():
        for grp in group_products(group_items):
            rep = min(grp, key=lambda x: len(x.name))  # shortest name as canonical
            prices = []
            for m in grp:
                prices.append({
                    "store": m.store, "store_id": STORE_IDS.get(m.store),
                    "price": float(m.price),
                    "unit_price": float(m.unit_price) if m.unit_price else None,
                    "unit_price_unit": m.unit_price_unit,
                    "product_url": m.product_url, "sku": m.sku,
                })
            catalog.append({
                "name": rep.name, "brand": rep.brand,
                "raw_category": rep.raw_category,
                "category_top": rep._top, "category_sub": rep._sub,
                "quantity": rep.quantity, "unit": rep.unit,
                "size_key": _size_key(rep.quantity, rep.unit),
                "image_url": rep.image_url, "country_code": "TR",
                "markets": [m.store for m in grp],
                "prices": prices,
            })
    return catalog


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ingest", action="store_true", help="post catalog to backend (Faz 3)")
    ap.add_argument("--rebuild", metavar="RAW_JSON",
                    help="skip scraping; re-classify+match from a raw_*.json cache "
                         "(use after a taxonomy change to avoid a fresh scrape)")
    args = ap.parse_args()

    from base_scraper import Product  # noqa
    if args.rebuild:
        log.info(f"--rebuild: ham önbellekten okunuyor: {args.rebuild}")
        with open(args.rebuild, encoding="utf-8") as f:
            raw = json.load(f)
        products = [Product.from_dict(d) for d in raw]
        log.info(f"önbellekten {len(products)} ürün yüklendi (scrape atlandı)")
    else:
        products = scrape_all()
        # cache raw products so a later taxonomy tweak can --rebuild without scraping
        rts = datetime.now().strftime("%Y%m%d_%H%M%S")
        raw_path = OUT / f"raw_{rts}.json"
        with open(raw_path, "w", encoding="utf-8") as f:
            json.dump([p.to_dict() for p in products], f, ensure_ascii=False)
        log.info(f"🗄️  ham önbellek -> {raw_path.name}")

    catalog = build_catalog(products)

    multi = [c for c in catalog if len(c["markets"]) > 1]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = OUT / f"matched_{ts}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    log.info(f"💾 katalog: {len(catalog)} kanonik ürün ({len(multi)} çok-marketli) -> {path.name}")
    dist = collections.Counter(c["category_top"] for c in catalog)
    log.info("kategori dağılımı: " + ", ".join(f"{k}={v}" for k, v in dist.most_common()))

    if args.ingest:
        import subprocess
        backend = ROOT / "cheep-backend-express"
        log.info("--ingest: backend'e yükleniyor (Prisma)...")
        # On Windows npx is a .cmd shim; pass the whole command as a string with
        # shell=True so cmd resolves it (a list + shell=True fails with WinError 267).
        if sys.platform == "win32":
            cmd = f'npx tsx scripts/ingest-catalog.ts "{path}"'
            r = subprocess.run(cmd, cwd=str(backend), shell=True)
        else:
            r = subprocess.run(["npx", "tsx", "scripts/ingest-catalog.ts", str(path)],
                               cwd=str(backend))
        log.info(f"ingest exit={r.returncode}")


if __name__ == "__main__":
    main()
