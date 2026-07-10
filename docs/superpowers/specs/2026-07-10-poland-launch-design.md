# Poland Launch — Design

**Date:** 2026-07-10
**Status:** Approved by Ruzgar (pilot scope amended to all 4 chains)
**Related:** `2026-07-01-multi-country-multi-language-design.md`, `2026-07-01-foreign-data-pipeline-design.md`, `2026-07-01-store-locations-design.md`

## Goal

Launch Cheep in Poland: scrape the Polish chains, integrate products into the correct categories with **zero wrong cross-store merges**, show users the markets of the country they are physically in (TR or PL only for now), and — once matching is verified error-free — put the whole pipeline on a continuous self-refreshing schedule like Turkey's.

## Scope and principles

- **Chains (v1):** Biedronka (store 44), Lidl (45), Żabka (47), Auchan (41). All four participate in the pilot from day one. Carrefour (40) stays disabled (Cloudflare) and is hidden in the app; it is a post-launch track.
- **Countries:** Only TR and PL are user-visible. CH/SE/DE stay in the DB and seed but are filtered out of every country picker and the location-based selector.
- **Zero-error definition:** an "error" is two different real-world products merged into one Cheep product. Matching is therefore *evidence-gated*: automatic merges happen only with proof; anything uncertain lands in a review queue and stays **unmerged** until approved. An unmerged product still appears in the app — it just doesn't participate in cross-store comparison. Precision over recall, always.

## 1. Location-based country selection (new feature)

On first launch / registration, the app requests location via `expo-location` (already a dependency), reverse-geocodes to an ISO country code, and if it is `TR` or `PL`, sets the active country automatically (drives the `x-country` header and `LocaleContext`).

- Permission denied, geocode failure, or country outside {TR, PL} → fall back to the existing manual picker in onboarding.
- Manual override in Profile remains; the app never silently switches country after the user has chosen one (a detected change only re-prompts, never auto-switches).
- Pickers in `OnboardingScreen.tsx` and `ProfileScreen.tsx` list only TR and PL.

## 2. Data pipeline — staged, audited, then automated

### Phase 1 — Pilot (all 4 chains, ~15 core categories)

Roughly 400–600 SKUs total across Biedronka, Lidl, Żabka, Auchan in core grocery categories (mleko, pieczywo, masło, jaja, ser, wędliny, mięso, owoce, warzywa, napoje, kawa/herbata, słodycze, przekąski, chemia domowa, higiena).

**Category mapping.** Chain category → canonical taxonomy via each chain's `category_map.json` (`Cheep-Scraper/countries/poland/`). During the pilot, 100% of pilot products are manually verified to land in the right category; the map is corrected until they do. The TR-only `category-matcher.service.ts` is bypassed for PL (as designed for foreign countries).

**Product matching — three evidence tiers.**

1. **EAN enrichment (strongest).** Resolve name+brand+quantity against the Open Food Facts open barcode database (PL has extensive coverage). A product whose EAN is confirmed merges exactly, same as Turkey's government-EAN flow, via the existing `@@unique([country_id, ean_barcode])` path.
2. **Deterministic merge.** Normalized name + brand + quantity identical across chains → auto-merge. Normalization must handle Polish diacritics (the trigram/unaccent machinery from migration `20260704120000_product_search_trgm` extends to PL).
3. **LLM proposal (weakest — never auto-merges).** The Gemini matcher (`llm-product-matcher.service.ts`) only *proposes* matches with a confidence score into a review queue. Nothing merges from this tier without approval.

The review queue is a DB table (`MatchProposal`: product pair, evidence tier, confidence, status) plus CLI tooling to render proposals side-by-side and approve/reject in batches — no admin UI in v1.

**Audit harness.** A script renders every merged group side-by-side (names, brands, quantities, prices, images per chain) for manual review, and tracks the error metric. **Gate: Phase 2 does not start until a full pilot audit shows 0 wrong merges.** Threshold calibration for tier 2 comes from this audit.

### Phase 2 — Scale to full catalog + automate

- Expand all four chains from pilot categories to their full scraped catalogs, keeping the same evidence gates. Review queue is worked down in batches; audit sampling continues (spot-check merged groups per ingest run).
- **Continuous refresh (Turkey pattern):** a scheduled fetch→ingest cycle on the droplet mirroring `deploy/cheep-fetcher.service` / `run-weekly.sh` — per-chain scrape, bulk-upsert via `/api/v1/store-prices/bulk-upsert` with `x-country: PL`, staleness pruning of prices not seen in N runs, and rate-limiting per chain.
- **Alerting:** each run compares per-chain item counts to the previous run; a drop beyond a threshold (site structure change, block) flags the run as failed and does not prune, so stale-but-correct data is preferred over a gutted catalog.

## 3. Store locations & routing

- Add Biedronka, Lidl, Żabka aliases to `src/config/store-brand-aliases.ts` (PL block currently only has Carrefour/Auchan); verify Auchan's.
- Run the Overpass/OSM import (`overpass.service.ts` + `store-branch.service.ts`) for all four chains → `StoreBranch` rows. Żabka is ~10k branches: chunk Overpass queries by voivodeship/bbox to stay under API limits.
- Give the PL `Store` rows fallback `lat/lon` (chain HQ or Warsaw center) so the route optimizer never sees null coordinates even mid-import.
- End-to-end check: a Warsaw-located user gets nearest-branch substitution, distance scoring, and a sane TSP route from `compare-engine.service.ts` / `route-optimizer.service.ts`.

## 4. App-side fixes

- **Assistant language:** `assistant.service.ts` system prompt currently hardcodes Turkish; reply language must come from `User.language` (currency is already parameterized).
- **Units:** normalize PL units (szt., opak., kg, g, l, ml) in `scrapers/units.py` / `foreign_import.py`; the `'adet'` default must not leak into PL rows (unit fallback becomes per-country, e.g. `szt.` for PL).
- **Mobile e2e:** extend `verify_multicountry.py` — PL user sees exactly 4 chains, `zł` formatting, Polish categories, and location-based country selection works (mock location both TR and PL, plus the permission-denied fallback).

## 5. Sequencing

| Phase | Work | Rough effort |
|---|---|---|
| 0 | Foundations: assistant language, TR/PL-only pickers, location-based country, PL units | 2–3 days |
| 1 | Pilot: 4 chains × ~15 categories, matching tiers, audit harness, **0-error gate** | 1–1.5 weeks |
| 2 | Scale: full catalogs, review-queue burn-down, scheduler + staleness pruning + alerts | 1 week |
| 3 | OSM branches for 4 chains + routing verification | 2–3 days |
| 4 | Mobile e2e + Play Store PL release | 2–3 days |

Phases 0 and 3 can run in parallel with the data track; the critical path is 1 → 2. Carrefour PL (Cloudflare bypass) is explicitly out of scope for v1 and tracked separately.

## Error handling

- Scraper failure or item-count collapse → run marked failed, no pruning, alert; previous prices stay live.
- OFF lookup ambiguity (multiple EAN candidates) → treated as no evidence; falls to tier 2/3.
- Reverse-geocode failure on mobile → manual picker; no blocking of onboarding on location.
- Bulk-upsert partial failures → chunked (900/batch) with per-chunk retry, consistent with `foreign_import.py`.

## Testing

- Scraper `parse()` functions stay fixture-tested (existing `countries/poland/fixtures/` + `test_pl_discounters.py` pattern) — no network in tests.
- Matching tiers get unit tests: EAN path, deterministic normalization (diacritics, quantity variants), and LLM-tier "never auto-merge" invariant.
- Audit harness output is itself the acceptance test for Phase 1's 0-error gate.
- Mobile: extended `verify_multicountry.py` e2e as above.
