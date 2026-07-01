"""Weekly orchestrator: run every country's foreign pipeline, staggered, isolated."""
import asyncio
import logging
import os
import time
from typing import Callable, List

from countries._common.pipeline import run_country_pipeline

logger = logging.getLogger(__name__)

DEFAULT_CONFIGS = [
    "countries/switzerland/config.json",
    "countries/sweden/config.json",
    "countries/germany/config.json",
    "countries/poland/config.json",
]


async def run_all(
    configs: List[str],
    api_url: str,
    stagger_seconds: int = 1800,
    sleep_fn: Callable[[int], None] = time.sleep,
) -> List[dict]:
    summary: List[dict] = []
    for i, cfg in enumerate(configs):
        if i > 0 and stagger_seconds:
            logger.info("Staggering %ss before %s", stagger_seconds, cfg)
            sleep_fn(stagger_seconds)
        try:
            result = await run_country_pipeline(cfg, api_url)
            summary.append({"country": cfg, "ok": True, "markets": result.get("markets", [])})
            logger.info("OK %s", cfg)
        except Exception as e:  # per-country isolation: never abort the batch
            logger.error("FAILED %s: %s", cfg, e, exc_info=True)
            summary.append({"country": cfg, "ok": False, "error": str(e)})
    return summary


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    api_url = os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1")
    stagger = int(os.getenv("CHEEP_STAGGER_SECONDS", "1800"))
    asyncio.run(run_all(DEFAULT_CONFIGS, api_url, stagger_seconds=stagger))


if __name__ == "__main__":
    main()
