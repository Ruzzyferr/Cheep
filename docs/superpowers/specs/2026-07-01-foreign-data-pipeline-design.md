# Cheep — Foreign Data Pipeline: Scrapers + Scheduler (Sub-project B)

**Date:** 2026-07-01
**Depends on:** Multi-country Phase 1 (merged @ `6a0430d`); shares infra with Sub-project A (store locations)
**Status:** Design (approved for spec review)

## 1. Goal

Populate **real grocery price data** for CH/SE/DE/PL so the multi-country app shows actual markets/prices (not just seed rows), refreshed **weekly on the night between Sunday and Monday**, country-scoped, matched cross-store by **EAN barcode**. Turkey already has a working pipeline; this extends the same config-driven architecture to four new countries.

**Success criteria:** for each country, at least the "anchor" chains yield real products with prices + EAN into the backend under the correct `country_id`; a scheduled job refreshes them weekly on the droplet; hard-discounter chains are attempted best-effort with graceful degradation and honest logging.

## 2. Existing architecture (reuse, don't reinvent)

The `Cheep-Scraper` repo is already country- and config-driven:
- `countries/<code>/config.json` lists markets (`name`, `store_id`, `scraper_path`, `scraper_class`, `scraper_method`, `enabled`, optional `headless`/`user_data_dir`).
- `countries/<code>/run_scrapers.py` dynamically loads each scraper via `importlib` and writes timestamped JSON to `output/`.
- `run_matcher.py` matches/normalizes; `import_to_backend.py` ingests (HTTP `POST /api/v1/store-prices/bulk-upsert` with `x-api-key`, or Kafka mode) and reads `COUNTRY_CODE` (default `TR`).
- `scrapers/base_scraper.py` `Product` dataclass already has `ean_barcode`, `country_code`, unit/quantity/unit_price fields. `scrapers/units.py` is language-agnostic. A `countries/poland/config.json.example` skeleton exists.
- Backend already accepts `country_code` on ingest and upserts products/prices under the right country (Phase 1).

## 3. Per-country packages

Create `countries/{ch,se,de,pl}/` each with a `config.json` and copies of `run_scrapers.py` / `run_matcher.py` / `import_to_backend.py` (the generic runners; only the category-map import + `COUNTRY_CODE` differ). Store IDs use the ranges seeded in Phase 1:

| Country | Anchors (real scrapers — full online catalog) | Best-effort (leaflet / hard) | Store IDs |
|---|---|---|---|
| 🇨🇭 CH | Migros CH, Coop | Denner, Aldi/Lidl Suisse | 10–19 |
| 🇸🇪 SE | ICA, Willys, Coop, Hemköp | City Gross | 20–29 |
| 🇩🇪 DE | REWE, Kaufland | Aldi Süd/Nord, Lidl, Penny, Netto, Edeka | 30–39 |
| 🇵🇱 PL | Carrefour PL, Auchan, Kaufland PL, Frisco | Biedronka, Lidl PL, Dino, Żabka | 40–49 |

Each chain → a scraper class (extend `BaseScraper` / implement `fetch_products()`) returning `Product` objects with `country_code` set and `ean_barcode` populated wherever the source exposes it.

**Degradation policy (per the "attempt every market" decision):**
- Anchor: real product+price+EAN scraper.
- Hard discounter: attempt catalog; if only weekly-offer/leaflet data exists, ingest that flagged `source='leaflet'`; if nothing is available, the config entry is **scaffolded + `enabled:false`** with a `note`. Never a hard pipeline failure.

## 4. Matching: EAN-first (language-agnostic)

New countries do **not** rebuild the 900-entry Turkish category dictionary. Matching precedence:
1. **EAN-13 barcode equality** (`Product.ean_barcode`, backend `@unique`) — exact, cross-store, language-neutral. This is the primary cross-store merge key in Europe.
2. **Fallback:** normalized name + brand + quantity (reuse `units.py`; strip diacritics; language-neutral tokens).
3. **Category:** thin per-country raw→canonical map (only what each chain's category strings require); canonical category **names are localized in the UI** via the Phase-1 i18n, not stored per language.

## 5. Scheduler (weekly, Sunday→Monday night)

Runs on the existing DigitalOcean droplet (167.71.36.167, Docker Compose). A scheduler service (cron in a container, or a host systemd timer) runs an orchestration `run_all_countries` that, per country, executes `run_scrapers → run_matcher → import_to_backend`.
- **Cadence:** weekly, night between Sunday and Monday. Default cron `0 2 * * 1` UTC (~03:00 CET, ~05:00 İstanbul), countries **staggered** (+~30 min each) to avoid resource contention. Final time/timezone confirmable at plan time.
- **Isolation:** per-country failure does not block other countries; each run logs to `countries/<code>/logs/` and reports a summary (products scraped, matched, ingested, chains that yielded nothing).
- **Deploy:** this **requires a server deploy** (new scraper code + scheduler onto the droplet). Secrets (`x-api-key`, DB, any proxy creds) live only in gitignored `.env` on the droplet — never committed.

## 6. Cross-link to Sub-project A (store locations)

Where a chain's site is scraped for prices, the scraper can **additionally emit branch locations** (from the chain's store-locator) into a branches feed that Sub-project A ingests into `StoreBranch`. This gives A free coverage for chains OSM covers poorly. Optional per chain; not required for a country's price pipeline to work.

## 7. Testing

- **Per-chain scrapers:** validated against **saved sample payloads (fixtures)** committed to the repo, since live foreign sites can't be reliably reached/deep-tested from the dev environment (geo-block/anti-bot). Each scraper has a fixture → asserts parsed `Product` fields (name, price, unit/quantity, ean where present).
- **EAN matcher:** unit tests — same EAN across two stores merges; different EAN never merges; name/brand/quantity fallback behaves.
- **Ingestion:** a dry-run/HTTP test against a local seeded backend confirms products land under the correct `country_id`.
- **Anchor chains e2e** validated where the site is reachable; results logged honestly (which chains produced data).

## 8. Risks (honest)

- **Foreign sites geo-block / anti-bot (Cloudflare, rate limits)** — anchors are the dependable core; may need Playwright/persistent-context (already used for A101) and possibly proxies (cost/complexity — decide per chain at plan time). Cannot be fully validated from here.
- **Hard discounters** (Biedronka, Aldi, Lidl…) frequently have **no full online catalog** — expect leaflet-only or nothing for several; "attempt every market" is best-effort, explicitly not guaranteed.
- **EAN availability** varies by source; where absent, matching leans on the fuzzier name+brand+quantity fallback (more residual mismatch).
- **Scheduler needs a droplet deploy** + live credentials (gitignored). Prior flagged secrets stay out of git and should be rotated.
- **Maintenance load:** scrapers break when sites change; per-chain isolation + logging keeps one breakage from taking down the batch.

## 9. Out of scope (YAGNI)

- Cross-currency conversion / cross-country "cheapest" (each country priced in its own currency — Phase 1 constraint).
- Real-time/continuous scraping (weekly batch only).
- Chains beyond the listed set (trivially addable later as config + a scraper class).
- Native-quality category taxonomy per language (EAN + thin maps suffice for launch).
