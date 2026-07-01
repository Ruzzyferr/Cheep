# Cheep — Real Store Locations (Sub-project A)

**Date:** 2026-07-01
**Depends on:** Multi-country Phase 1 (merged @ `6a0430d`)
**Status:** Design (approved for spec review)

## 1. Goal

Show each user the **real nearest branch** of every chain and **real distances**, based on their device location, for all supported countries (TR/CH/SE/DE/PL) — using **only free data**. This fixes the reported bug where a user in Mardin sees İzmir: today every national chain is a single placeholder `Store` row located in İzmir, so the app has no concept of "a Migros near me."

**Success criteria:** given a user's lat/lon, the app can name the nearest branch of each chain in their country and compute a truthful distance; no paid API; user location never leaves our backend; Turkey works first, but the design covers all five countries.

## 2. Data source strategy (free, multi-country)

We own a `StoreBranch` table, populated primarily from **OpenStreetMap via the Overpass API** (free, global, one integration for all countries), supplemented by per-chain store-locator scraping where OSM coverage is thin.

- **Primary — OSM/Overpass:** per country, query supermarket/convenience nodes+ways (`shop=supermarket`, `shop=convenience`, `shop=grocery`) whose `brand`/`brand:wikidata`/`name` match one of our chains, within the country's area. Overpass is free (fair-use rate limits → run as a periodic batch, not per-request). Coordinates come from node lat/lon or way centroid.
- **Supplement — store-locator scraping:** for chains where OSM is sparse (likely TR discounters, Frisco-type online-only), scrape that chain's official "find a store" page/API for real branch coordinates. This **reuses the Sub-project B scraper infrastructure**; each price-scraper can additionally emit branch data.
- **Refresh:** branches change rarely — a monthly (or on-demand) re-sync job upserts by `external_ref`. No per-request cost; **the user's location is only ever used in our own backend query**, never sent to a third party.

**Brand matching** is the main data-quality risk: OSM tagging is inconsistent (`brand`, `name`, `operator`, casing, local spellings). Mitigation: a per-chain **brand-alias list** (e.g. `Migros` ↔ {"Migros","Migros Jet","Migros M","Mmm Migros"}; `ŞOK` ↔ {"ŞOK","Sok Market","ŞOK Market"}) maintained in config, matched case/diacritic-insensitively.

## 3. Data model

New Prisma model; `Store` stays the national chain, `StorePrice` stays per-chain (national pricing). Branches are location-only.

```prisma
model StoreBranch {
  id          Int      @id @default(autoincrement())
  store_id    Int      // chain FK (Store)
  country_id  Int
  name        String   // branch display name
  lat         Float
  lon         Float
  address     String?
  city        String?
  source      String   // 'osm' | 'locator'
  external_ref String  @unique // e.g. 'osm:node/123' or 'locator:migros:4567'
  updated_at  DateTime @updatedAt
  created_at  DateTime @default(now())

  store       Store    @relation(fields: [store_id], references: [id], onDelete: Cascade)
  country     Country  @relation(fields: [country_id], references: [id], onDelete: Cascade)

  @@index([country_id])
  @@index([store_id])
  @@index([lat, lon])
  @@map("store_branches")
}
```

`Store` gains `branches StoreBranch[]`; `Country` gains `branches StoreBranch[]`. The existing `Store.lat/lon/address` (İzmir placeholders) are deprecated for distance once branches exist — the compare-engine and nearby query prefer branch coordinates.

## 4. Backend

1. **Overpass ingestion** (`cheep-backend-express/scripts/import-branches.ts`, run via `tsx`, or a job under the scraper repo): for each country + chain brand-alias set, build an Overpass QL query, fetch, parse elements → upsert `StoreBranch` by `external_ref`. Idempotent; logs counts per chain. Bounded/paged; respects Overpass rate limits. A saved sample response is committed as a test fixture.
2. **Nearby endpoint** — `GET /api/v1/stores/nearby?lat=&lon=&limit=` (country-scoped via `x-country`): returns, per chain in the country, the nearest branch with its haversine distance, sorted ascending. Implementation: bounding-box prefilter (±~0.5° around the point) in SQL, then haversine sort in JS (or PostGIS `ST_Distance` if the extension is available; fall back to raw SQL/JS haversine otherwise — decide at implementation by probing the DB). Returns `[]` gracefully when a country has no branches yet.
3. **Compare-engine distance uses branches.** When the client sends `userLocation`, resolve each candidate chain's **nearest branch** to that location and use those coords for distance/route (instead of the single `Store.lat/lon` placeholder). Extract a small helper `nearestBranchCoords(storeId, countryId, userLocation)` (pure, testable with fixture branches). No cross-country leak: only branches in `req.country.id` are considered (StoreBranch is country-scoped).

## 5. Mobile

1. **Send `userLocation` to compare.** `CompareResultsScreen` currently calls `listService.compareList(listId, { maxStores, includeMissingProducts })` with no location. Add `userLocation` from the existing `getUserLocation()` (permission-gated, cached) so distances become real. Distances already render behind `totalDistance > 0` guards.
2. **"Nearest stores" surface (optional, small).** Use `GET /stores/nearby` to show the user's nearest branch per chain (Home section or `StoreDetailScreen`, which is currently a "coming soon" stub). i18n + `formatDistance` already exist.
3. **Fix the permission promise.** `app.json` location text currently promises "distance to nearby markets," which the app couldn't deliver. Keep the promise but ensure it's now truthful once branches exist; keep wording honest for the no-branch-data case.

## 6. Testing

- **Ingestion:** parse a committed Overpass JSON fixture → asserts correct `StoreBranch` rows (brand match, coords, external_ref) and idempotent re-upsert (no duplicates).
- **Brand matching:** unit test the alias matcher (diacritic/case-insensitive; `ŞOK` vs `sok market`).
- **Nearby / nearest-branch:** unit test `nearestBranchCoords` + the nearby sort with fixture branches at known coords and a known user point (e.g. a Mardin point resolves to a Mardin branch, not İzmir).
- **Compare distance:** with fixture branches, compare returns real (non-zero, sane) distances and never mixes countries.

## 7. Out of scope (YAGNI)

- Turn-by-turn navigation / map rendering in-app (deep-link to the device map app is enough later).
- Per-branch pricing (prices remain national per chain).
- Real-time Overpass calls per user request (batch sync only).
- Paid providers (Google Places) — excluded by the free constraint.

## 8. Risks

- **OSM coverage varies** (esp. TR + hard discounters) → locator-scrape fallback per weak chain; log coverage per chain/country so gaps are visible, never silently empty.
- **Brand-alias maintenance** — a small config list per chain; expect iteration.
- **Overpass rate limits / downtime** — batch job with retry/backoff; data is cached in our DB so runtime is unaffected.
- **Way/relation geometry** — use element `center` for ways/relations; skip elements without resolvable coordinates.
