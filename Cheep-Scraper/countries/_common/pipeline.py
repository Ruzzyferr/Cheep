"""Run one country's foreign pipeline: scrape all enabled markets, then import
each market's freshest output to the backend (EAN-first). No LLM matcher."""
import asyncio
import json
import logging
import os
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

    importer = ForeignImporter(api_url, country_code=country_code, api_key=os.getenv("INGEST_API_KEY"))
    enricher = None
    if config.get("off_enrich"):
        from countries._common.off_enrich import OffEnricher
        enricher = OffEnricher(country_code, str(country_dir / "off_cache.sqlite"))
    summary = {"country": country_code, "markets": []}
    for r in scrape_results:
        with open(r["output_file"], "r", encoding="utf-8") as f:
            products = json.load(f)
        if enricher is not None:
            enricher.enrich(products)
        stats = importer.import_products(products, store_id=r["store_id"], category_map=category_map, default_unit=default_unit)
        logger.info("%s %s: scraped=%s imported=%s failed=%s",
                    country_code, r["market"], r["product_count"], stats["successful"], stats["failed"])
        summary["markets"].append({"market": r["market"], **stats})
    return summary


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("config", help="path to a country config.json")
    parser.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    asyncio.run(run_country_pipeline(args.config, args.api_url))


if __name__ == "__main__":
    main()
