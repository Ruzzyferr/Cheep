"""Run one country's foreign pipeline: scrape all enabled markets, then import
each market's freshest output to the backend (EAN-first). No LLM matcher."""
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict

from countries._common.runner import CountryScraperRunner
from countries._common.foreign_import import ForeignImporter

logger = logging.getLogger(__name__)


def _load_category_map(country_dir: Path) -> Dict[str, str]:
    path = country_dir / "category_map.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def should_import(market: str, new_count: int, prev_counts: Dict, min_ratio: float = 0.6) -> bool:
    """Ürün sayısı önceki başarılı koşuya göre çökmüşse (site yapısı değişti /
    engellendi) import ETME — eski-ama-doğru veri, boşaltılmış katalogdan iyidir."""
    prev = prev_counts.get(market)
    if not prev:
        return True
    return new_count >= prev * min_ratio


async def run_country_pipeline(config_path: str, api_url: str = "http://localhost:3000/api/v1") -> Dict:
    config_path = Path(config_path)
    country_dir = config_path.parent
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    country_code = config["country_code"]
    default_unit = config.get("default_unit", "adet")
    category_map = _load_category_map(country_dir)

    runner = CountryScraperRunner(str(config_path))
    scrape_results = await runner.run_all()

    counts_path = country_dir / "output" / "last_good_counts.json"
    prev_counts = json.loads(counts_path.read_text(encoding="utf-8")) if counts_path.exists() else {}

    importer = ForeignImporter(api_url, country_code=country_code, api_key=os.getenv("INGEST_API_KEY"))
    enricher = None
    if config.get("off_enrich"):
        from countries._common.off_enrich import OffEnricher
        enricher = OffEnricher(country_code, str(country_dir / "off_cache.sqlite"))
    summary = {"country": country_code, "markets": []}
    for r in scrape_results:
        with open(r["output_file"], "r", encoding="utf-8") as f:
            products = json.load(f)

        if not should_import(r["market"], len(products), prev_counts):
            logger.error("%s %s: ürün sayısı çöktü (%s, önceki %s) — import atlandı",
                         country_code, r["market"], len(products), prev_counts.get(r["market"]))
            summary["markets"].append({"market": r["market"], "skipped": "count_collapse"})
            continue

        if enricher is not None:
            try:
                enricher.enrich(products)
            except Exception as e:
                logger.error("OFF enrichment failed for %s — importing without enrichment: %s", r["market"], e)
        stats = importer.import_products(products, store_id=r["store_id"], category_map=category_map, default_unit=default_unit)
        logger.info("%s %s: scraped=%s imported=%s failed=%s",
                    country_code, r["market"], r["product_count"], stats["successful"], stats["failed"])
        summary["markets"].append({"market": r["market"], **stats})
        prev_counts[r["market"]] = len(products)

    counts_path.parent.mkdir(parents=True, exist_ok=True)
    counts_path.write_text(json.dumps(prev_counts), encoding="utf-8")
    return summary


def summary_is_healthy(summary: Dict) -> bool:
    """Pure decision function: should the caller treat this pipeline run as
    successful enough to gate downstream actions (e.g. weekly prune) on?

    A run is healthy only if there is at least one market entry and every
    market entry both avoided count-collapse (no `skipped`) and had zero
    failed imports."""
    markets = summary.get("markets") or []
    if not markets:
        return False
    for market in markets:
        if market.get("skipped"):
            return False
        if market.get("failed", 0) > 0:
            return False
    return True


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("config", help="path to a country config.json")
    parser.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    summary = asyncio.run(run_country_pipeline(args.config, args.api_url))
    if not summary_is_healthy(summary):
        bad = [
            m for m in (summary.get("markets") or [])
            if m.get("skipped") or m.get("failed", 0) > 0
        ]
        logger.error(
            "%s: run unhealthy (skipped/failed markets: %s) — refusing to exit 0, "
            "downstream prune must not run",
            summary.get("country"), bad or "no markets scraped",
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
