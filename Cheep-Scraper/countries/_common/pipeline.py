"""Run one country's foreign pipeline: scrape all enabled markets, then import
each market's freshest output to the backend (EAN-first). No LLM matcher."""
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from countries._common.runner import CountryScraperRunner
from countries._common.foreign_import import ForeignImporter

logger = logging.getLogger(__name__)


def _load_category_map(country_dir: Path) -> Dict[str, str]:
    path = country_dir / "category_map.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def filter_products_by_category_domain(
    products: List[Dict],
    allow_prefixes: Optional[List[str]] = None,
    deny_prefixes: Optional[List[str]] = None,
) -> Tuple[List[Dict], Dict[str, int]]:
    """Grocery-domain ingest filter, applied before enrichment/import.

    Cheep is a grocery app: a market's full catalog can include durable
    general-merchandise (clothing/tools/garden/electronics/furniture) that
    must never be ingested. `allow_prefixes`/`deny_prefixes` are lists of
    raw_category breadcrumb prefixes (plain `str.startswith` match, no
    "prefix:" marker — that marker is only used inside category_map.json's
    slug-resolution keys).

    Semantics:
    - A product with NO raw_category (e.g. Żabka, which has no category
      field at all) is always KEPT — there is nothing to filter on.
    - deny takes precedence: a product matching any deny prefix is dropped.
    - when an allow list is configured, a product must match at least one
      allow prefix to be kept (checked only when it didn't already match a
      deny prefix).
    - with neither list configured, every product is kept unchanged.
    """
    if not allow_prefixes and not deny_prefixes:
        return list(products), {"kept": len(products), "dropped": 0}

    kept: List[Dict] = []
    dropped = 0
    for product in products:
        raw_cat = product.get("raw_category") or product.get("category")
        if not raw_cat:
            kept.append(product)
            continue
        if deny_prefixes and any(raw_cat.startswith(p) for p in deny_prefixes):
            dropped += 1
            continue
        if allow_prefixes and not any(raw_cat.startswith(p) for p in allow_prefixes):
            dropped += 1
            continue
        kept.append(product)
    return kept, {"kept": len(kept), "dropped": dropped}


def resolve_enrich_mode(config: Dict) -> Optional[str]:
    """Pure decision: which OFF EAN-enrichment path (if any) does this
    country config want? "bulk" (local dataset index, off_bulk.py) takes
    priority over the legacy "api" (per-product live search, off_enrich.py)
    path if a config were ever to set both — configs should set only one
    (Poland's config.json sets off_bulk and no longer sets off_enrich)."""
    if config.get("off_bulk"):
        return "bulk"
    if config.get("off_enrich"):
        return "api"
    return None


def should_import(market: str, new_count: int, prev_counts: Dict, min_ratio: float = 0.6) -> bool:
    """Ürün sayısı önceki başarılı koşuya göre çökmüşse (site yapısı değişti /
    engellendi) import ETME — eski-ama-doğru veri, boşaltılmış katalogdan iyidir."""
    prev = prev_counts.get(market)
    if not prev:
        return True
    return new_count >= prev * min_ratio


def select_markets(config_markets: List[Dict], names: Optional[List[str]] = None) -> List[Dict]:
    """Pure decision: which of a country's configured markets should this
    pipeline invocation scrape? Backs the `--markets` CLI flag used for
    chain-rotation scheduling (spread a large catalog's refresh across the
    week instead of scraping every enabled market every night).

    - names is None -> every enabled market, config order (current/full-run
      behavior, e.g. run-weekly.sh's manual full refresh).
    - names is a list -> only those markets, returned in the given order.
      Each name MUST name a market that both exists in config_markets AND
      has enabled=True, or this raises ValueError -- an unknown or disabled
      name must hard-error, never silently fall back to running everything
      (or fewer markets than the caller asked for).
    - Never returns a disabled market, named or not.
    """
    enabled_by_name = {m["name"]: m for m in config_markets if m.get("enabled", False)}
    if names is None:
        return [m for m in config_markets if m.get("enabled", False)]
    selected: List[Dict] = []
    for name in names:
        market = enabled_by_name.get(name)
        if market is None:
            raise ValueError(
                f"unknown or disabled market {name!r} -- enabled markets are: "
                f"{sorted(enabled_by_name)}"
            )
        selected.append(market)
    return selected


async def run_country_pipeline(
    config_path: str,
    api_url: str = "http://localhost:3000/api/v1",
    markets: Optional[List[str]] = None,
) -> Dict:
    config_path = Path(config_path)
    country_dir = config_path.parent
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    country_code = config["country_code"]
    default_unit = config.get("default_unit", "adet")
    category_map = _load_category_map(country_dir)
    market_configs = {m["name"]: m for m in config.get("markets", [])}
    selected_markets = select_markets(config.get("markets", []), markets)

    runner = CountryScraperRunner(str(config_path))
    runner.config["markets"] = selected_markets
    scrape_results = await runner.run_all()

    counts_path = country_dir / "output" / "last_good_counts.json"
    prev_counts = json.loads(counts_path.read_text(encoding="utf-8")) if counts_path.exists() else {}

    importer = ForeignImporter(api_url, country_code=country_code, api_key=os.getenv("INGEST_API_KEY"))
    enrich_mode = resolve_enrich_mode(config)
    enrich_fn = None
    if enrich_mode == "bulk":
        from countries._common.off_bulk import ensure_pl_index, enrich_from_index
        off_bulk_sqlite = ensure_pl_index(country_dir)
        enrich_fn = lambda products: enrich_from_index(products, off_bulk_sqlite)
    elif enrich_mode == "api":
        from countries._common.off_enrich import OffEnricher
        enricher = OffEnricher(country_code, str(country_dir / "off_cache.sqlite"))
        enrich_fn = enricher.enrich
    # Bu koşumda ÇALIŞTIRILMASI İSTENEN marketler. `summary_is_healthy` bunu
    # "beklenen" listesi olarak kullanır: sıfır ürün çeken bir market
    # `runner`'dan None döner ve `scrape_results`'a HİÇ girmez, dolayısıyla
    # aşağıdaki döngüye de girmez ve özette görünmez. Sağlık kapısı yalnızca
    # VAR OLAN girdilere baktığı için böyle bir market sessizce "yokmuş" gibi
    # davranıyor, koşum sağlıklı sayılıyor ve ülke çapında prune tetikleniyordu.
    summary = {
        "country": country_code,
        "markets": [],
        "expected_markets": [m["name"] for m in selected_markets],
    }
    for r in scrape_results:
        with open(r["output_file"], "r", encoding="utf-8") as f:
            products = json.load(f)

        # HAM sayı filtreden ÖNCE saklanır. Eskiden kapı ham sayıyı ölçüyor
        # ama taban çizgisine FİLTRELENMİŞ sayı yazılıyordu (aşağıda
        # `products` yeniden bağlanıyor). Lidl'de ham ~6.300, filtreden sonra
        # ~54 — yani ertesi gece test "ham >= 32" oluyordu ve kapı fiilen
        # devre dışı kalıyordu. İkisi de artık ham sayı.
        raw_count = len(products)
        if not should_import(r["market"], raw_count, prev_counts):
            logger.error("%s %s: ürün sayısı çöktü (%s, önceki %s) — import atlandı",
                         country_code, r["market"], len(products), prev_counts.get(r["market"]))
            summary["markets"].append({"market": r["market"], "skipped": "count_collapse"})
            continue

        mconf = market_configs.get(r["market"], {})
        allow_prefixes = mconf.get("category_allow_prefixes")
        deny_prefixes = mconf.get("category_deny_prefixes")
        if allow_prefixes or deny_prefixes:
            products, filter_stats = filter_products_by_category_domain(
                products, allow_prefixes, deny_prefixes,
            )
            logger.info("%s %s: category domain filter kept=%s dropped=%s",
                        country_code, r["market"], filter_stats["kept"], filter_stats["dropped"])

        if enrich_fn is not None:
            try:
                enrich_fn(products)
            except Exception as e:
                logger.error("OFF enrichment failed for %s — importing without enrichment: %s", r["market"], e)
        stats = importer.import_products(products, store_id=r["store_id"], category_map=category_map, default_unit=default_unit)
        logger.info("%s %s: scraped=%s imported=%s failed=%s",
                    country_code, r["market"], r["product_count"], stats["successful"], stats["failed"])
        summary["markets"].append({"market": r["market"], **stats})
        prev_counts[r["market"]] = raw_count

    counts_path.parent.mkdir(parents=True, exist_ok=True)
    counts_path.write_text(json.dumps(prev_counts), encoding="utf-8")

    # Eşlenemeyen kategoriler koşunun sonunda raporlanır: ürün kaydedildi ama
    # KATEGORİSİZ, yani hiçbir listede görünmüyor. Sessizce geçmesin.
    from countries._common.foreign_import import report_unmapped_categories
    summary["unmapped_categories"] = report_unmapped_categories(logger)

    return summary


def summary_is_healthy(summary: Dict) -> bool:
    """Pure decision function: should the caller treat this pipeline run as
    successful enough to gate downstream actions (e.g. weekly prune) on?

    A run is healthy only if there is at least one market entry and every
    market entry avoided count-collapse (no `skipped`) and kept failed
    imports within tolerance.

    Failure tolerance (2026-07-23): the original zero-failed rule was too
    strict in practice — a SINGLE malformed item out of 1,003 (prod
    Biedronka, 2026-07-21) marked the whole run unhealthy, which cancelled
    the nightly prune AND the EAN harvest even though 1,002 real prices had
    just been imported. The gate exists to stop prune after a *collapsed*
    run, not to demand perfection: tolerate up to max(1, 1%) failed imports
    per market, as long as that market still imported something.

    MISSING-MARKET RULE (2026-08-25): a market that scraped ZERO products
    returns None from the runner, never lands in `scrape_results`, and so
    never appears in `summary["markets"]` at all. Inspecting only the
    entries that ARE present therefore treated a totally failed chain as if
    it had never been asked to run: the summary looked healthy, the caller
    exited 0, and `run-daily.sh` fired the country-wide prune. Repeat that
    past the 21-day TTL and the chain's entire catalog is deleted, cascading
    into users' saved list items. So every EXPECTED market must be accounted
    for. `expected_markets` is absent from older/synthetic summaries; there
    the rule is skipped rather than failing closed on data we never had."""
    markets = summary.get("markets") or []
    if not markets:
        return False

    expected = summary.get("expected_markets")
    if expected:
        reported = {m.get("market") for m in markets}
        if any(name not in reported for name in expected):
            return False
    for market in markets:
        if market.get("skipped"):
            return False
        failed = market.get("failed", 0)
        if failed > 0:
            successful = market.get("successful", 0)
            if successful == 0:
                return False
            if failed > max(1, (successful + failed) // 100):
                return False
    return True


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("config", help="path to a country config.json")
    parser.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    parser.add_argument(
        "--markets", default=None,
        help="comma-separated market names to run this invocation (e.g. "
             "'Lidl,Żabka'). Default: every enabled market. Used for "
             "chain-rotation scheduling -- an unknown or disabled name is a "
             "hard error, this never silently falls back to running everything.",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    market_names = [m.strip() for m in args.markets.split(",")] if args.markets else None
    try:
        summary = asyncio.run(run_country_pipeline(args.config, args.api_url, markets=market_names))
    except ValueError as e:
        logger.error("%s", e)
        sys.exit(1)
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
