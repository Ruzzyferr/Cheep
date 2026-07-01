# Store Locations (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every user their real nearest branch per chain and truthful distances (all countries, free data), replacing the single İzmir-placeholder-per-chain that made a Mardin user see İzmir.

**Architecture:** A new country-scoped `StoreBranch` table is bulk-populated from OpenStreetMap/Overpass (free) via an ingestion script keyed by per-chain brand aliases. A `GET /stores/nearby` endpoint and the compare-engine resolve the nearest branch to the user's location (bbox prefilter + haversine). Prices stay national (per chain); branches are location-only. Mobile sends `userLocation` to compare and can show nearest stores.

**Tech Stack:** Backend — Node ESM, Express, Prisma (Postgres), vitest, `tsx` scripts, native `fetch` for Overpass. Mobile — Expo/React Native, existing `expo-location` (`getUserLocation`).

## Global Constraints

- **Backend ESM:** all relative imports end in `.js` (even for `.ts`). Tests import from `../src/...js`.
- **Backend tests:** vitest, files in `cheep-backend-express/test/*.test.ts`; run one with `npm test -- <name>`. Keep new logic in pure, fixture-testable helpers (existing tests mock `../src/utils/prisma.client.js`; do not write live-DB or live-network tests).
- **Free data only:** OpenStreetMap/Overpass. No paid API (no Google Places). The user's location is used only inside our backend query — never sent to a third party.
- **Country scoping:** `StoreBranch` rows carry `country_id`; the nearby endpoint and compare branch-resolution consider only `req.country.id`. No cross-country leak (consistent with Phase 1's hard invariant).
- **Prices stay national:** `Store` remains the chain, `StorePrice.store_id` unchanged. Branches never carry prices.
- **Idempotent ingestion:** upsert `StoreBranch` by unique `external_ref` (`osm:node/<id>` etc.); re-runs must not duplicate.
- **Store ID ranges (from Phase 1):** TR 1–9, CH 10–19, SE 20–29, DE 30–39, PL 40–49. Branch `store_id` FKs point at those chain rows.
- **Coordinates:** WGS84 lat/lon floats. Haversine in km.

---

## File Structure

**Backend (`cheep-backend-express/`)**
- `prisma/schema.prisma` — add `StoreBranch` model + `branches` relations on `Store`/`Country`.
- `src/config/store-brand-aliases.ts` — per-chain brand-alias lists (TR/CH/SE/DE/PL), the OSM match config.
- `src/services/store-branch.service.ts` — pure helpers: `haversineKm`, `nearestBranchPerStore`, `getNearbyStores`, `resolveNearestBranchCoords`.
- `src/api/stores/stores.controller.ts` + `stores.routes.ts` — `GET /stores/nearby`.
- `src/services/overpass.service.ts` — `buildOverpassQuery`, `parseOverpassElements`, `matchChain` (pure parse/match, no network).
- `scripts/import-branches.ts` — CLI: fetch Overpass per country + upsert (network + DB; the one non-unit part).
- `src/services/compare-engine.service.ts` — use branch coords when `userLocation` present.
- `test/store-branch.test.ts`, `test/overpass-parse.test.ts` — vitest.
- `test/fixtures/overpass-tr-sample.json` — committed Overpass response fixture.

**Mobile (`Cheep-Mobile/`)**
- `src/constants/api.ts` — add `STORES.NEARBY`.
- `src/services/store.service.ts` — `getNearbyStores(lat, lon)`.
- `src/types/index.ts` — add `userLocation` to `CompareRequest`; add `NearbyStore` type.
- `src/screens/lists/CompareResultsScreen.tsx` — send `userLocation` to compare.
- `app.json` — honest location-permission copy.

---

## Task 1: `StoreBranch` model + migration

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma`

**Interfaces:**
- Produces: `StoreBranch { id, store_id, country_id, name, lat, lon, address?, city?, source, external_ref @unique, created_at, updated_at }`; `Store.branches`, `Country.branches`.

- [ ] **Step 1: Add the model + relations**

In `schema.prisma`, add after the `Store` model (schema.prisma:93):

```prisma
model StoreBranch {
  id           Int      @id @default(autoincrement())
  store_id     Int
  country_id   Int
  name         String
  lat          Float
  lon          Float
  address      String?
  city         String?
  source       String   // 'osm' | 'locator'
  external_ref String   @unique // 'osm:node/123', 'locator:migros:4567'
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  store   Store   @relation(fields: [store_id], references: [id], onDelete: Cascade)
  country Country @relation(fields: [country_id], references: [id], onDelete: Cascade)

  @@index([country_id])
  @@index([store_id])
  @@index([lat, lon])
  @@map("store_branches")
}
```

Add `branches StoreBranch[]` to the `Store` model's relations block (after `affiliate_clicks  AffiliateClick[]`, schema.prisma:89) and to the `Country` model's relations block (after `users    User[]`, schema.prisma:60).

- [ ] **Step 2: Create + apply the migration**

Run: `cd cheep-backend-express && npm run db:migrate:dev`
Expected: a migration creating `store_branches` with the FKs/indexes; `prisma generate` runs. (Local Postgres `cheep-postgres` on 5434 is up.)

- [ ] **Step 3: Verify the client type**

Run: `npx tsc --noEmit`
Expected: PASS. `prisma.storeBranch` is now typed.

- [ ] **Step 4: Commit**

```bash
git add cheep-backend-express/prisma/schema.prisma cheep-backend-express/prisma/migrations
git commit -m "feat(backend): StoreBranch model (real per-chain branch locations)"
```

---

## Task 2: Brand-alias config + Overpass parse/match (pure)

**Files:**
- Create: `cheep-backend-express/src/config/store-brand-aliases.ts`
- Create: `cheep-backend-express/src/services/overpass.service.ts`
- Create: `cheep-backend-express/test/overpass-parse.test.ts`
- Create: `cheep-backend-express/test/fixtures/overpass-tr-sample.json`

**Interfaces:**
- Produces:
  - `store-brand-aliases.ts`: `BRAND_ALIASES: Record<countryCode, Array<{ store_id: number; chain: string; aliases: string[] }>>`.
  - `overpass.service.ts`: `normalizeName(s: string): string`; `matchChain(tags: Record<string,string>, aliases: Array<{store_id,chain,aliases}>): {store_id, chain} | null`; `parseOverpassElements(json: any, aliases): BranchInput[]` where `BranchInput = { store_id: number; name: string; lat: number; lon: number; address?: string; city?: string; external_ref: string; source: 'osm' }`; `buildOverpassQuery(areaName: string, aliases): string`.

- [ ] **Step 1: Write the brand aliases config**

Create `src/config/store-brand-aliases.ts`. Populate the Phase-1 chains with their store_ids (TR 1–4, CH 10/11, SE 20/21, DE 30/31, PL 40/41) and common OSM name/brand spellings:

```ts
export interface ChainAlias { store_id: number; chain: string; aliases: string[]; }

export const BRAND_ALIASES: Record<string, ChainAlias[]> = {
  TR: [
    { store_id: 1, chain: 'Migros', aliases: ['migros', 'migros jet', 'migros m', 'mmm migros', 'money'] },
    { store_id: 2, chain: 'CarrefourSA', aliases: ['carrefour', 'carrefoursa', 'carrefour sa', 'carrefour express'] },
    { store_id: 3, chain: 'A101', aliases: ['a101', 'a 101'] },
    { store_id: 4, chain: 'ŞOK', aliases: ['sok', 'sok market', 'şok', 'şok market'] },
  ],
  CH: [
    { store_id: 10, chain: 'Migros', aliases: ['migros'] },
    { store_id: 11, chain: 'Coop', aliases: ['coop', 'coop pronto'] },
  ],
  SE: [
    { store_id: 20, chain: 'ICA', aliases: ['ica', 'ica maxi', 'ica kvantum', 'ica nara', 'ica supermarket'] },
    { store_id: 21, chain: 'Willys', aliases: ['willys'] },
  ],
  DE: [
    { store_id: 30, chain: 'REWE', aliases: ['rewe', 'rewe city', 'rewe center'] },
    { store_id: 31, chain: 'Kaufland', aliases: ['kaufland'] },
  ],
  PL: [
    { store_id: 40, chain: 'Carrefour', aliases: ['carrefour', 'carrefour express', 'carrefour market'] },
    { store_id: 41, chain: 'Auchan', aliases: ['auchan', 'auchan supermarket'] },
  ],
};
```

- [ ] **Step 2: Write the failing parse/match test + fixture**

Create `test/fixtures/overpass-tr-sample.json` (a minimal but realistic Overpass JSON — a node with a matching brand, a way with `center`, and a non-matching shop):

```json
{ "elements": [
  { "type": "node", "id": 111, "lat": 37.3212, "lon": 40.7245, "tags": { "shop": "supermarket", "brand": "Migros", "name": "Migros Mardin", "addr:city": "Mardin", "addr:street": "Cumhuriyet Cd." } },
  { "type": "way", "id": 222, "center": { "lat": 38.4190, "lon": 27.1288 }, "tags": { "shop": "supermarket", "name": "ŞOK Market Konak", "addr:city": "İzmir" } },
  { "type": "node", "id": 333, "lat": 41.0, "lon": 29.0, "tags": { "shop": "bakery", "name": "Random Fırın" } }
] }
```

Create `test/overpass-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseOverpassElements, matchChain, normalizeName } from '../src/services/overpass.service.js';
import { BRAND_ALIASES } from '../src/config/store-brand-aliases.js';

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/overpass-tr-sample.json', import.meta.url)), 'utf8'));

describe('overpass parse/match', () => {
  it('normalizeName strips diacritics + lowercases', () => {
    expect(normalizeName('ŞOK Market')).toBe('sok market');
    expect(normalizeName('Migros M')).toBe('migros m');
  });

  it('matchChain matches by brand or name alias, diacritic-insensitive', () => {
    expect(matchChain({ brand: 'Migros' }, BRAND_ALIASES.TR)?.store_id).toBe(1);
    expect(matchChain({ name: 'ŞOK Market Konak' }, BRAND_ALIASES.TR)?.store_id).toBe(4);
    expect(matchChain({ name: 'Random Fırın' }, BRAND_ALIASES.TR)).toBeNull();
  });

  it('parseOverpassElements yields branches for matches only, using node coords or way center', () => {
    const out = parseOverpassElements(fixture, BRAND_ALIASES.TR);
    expect(out).toHaveLength(2);
    const migros = out.find(b => b.store_id === 1)!;
    expect(migros.external_ref).toBe('osm:node/111');
    expect(migros.city).toBe('Mardin');
    expect(migros.lat).toBeCloseTo(37.3212);
    const sok = out.find(b => b.store_id === 4)!;
    expect(sok.external_ref).toBe('osm:way/222');
    expect(sok.lat).toBeCloseTo(38.4190);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- overpass-parse`
Expected: FAIL — module/functions not defined.

- [ ] **Step 4: Implement `overpass.service.ts`**

```ts
import type { ChainAlias } from '../config/store-brand-aliases.js';

export interface BranchInput {
  store_id: number; name: string; lat: number; lon: number;
  address?: string; city?: string; external_ref: string; source: 'osm';
}

const DIACRITICS: Record<string, string> = {
  'ı':'i','İ':'i','ş':'s','Ş':'s','ğ':'g','Ğ':'g','ç':'c','Ç':'c','ö':'o','Ö':'o','ü':'u','Ü':'u',
  'å':'a','ä':'a','ö':'o','é':'e','ł':'l','ń':'n','ś':'s','ż':'z','ź':'z','ą':'a','ę':'e','ó':'o','à':'a','â':'a','ê':'e',
};
export function normalizeName(s: string): string {
  return (s || '').split('').map(c => DIACRITICS[c] ?? c).join('').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function matchChain(tags: Record<string, string>, aliases: ChainAlias[]): { store_id: number; chain: string } | null {
  const brand = normalizeName(tags.brand || '');
  const name = normalizeName(tags.name || '');
  for (const a of aliases) {
    for (const alias of a.aliases) {
      const al = normalizeName(alias);
      if (brand === al || name === al || name.startsWith(al + ' ') || name.includes(' ' + al) || (brand && brand.includes(al)) || name.split(' ')[0] === al) {
        return { store_id: a.store_id, chain: a.chain };
      }
    }
  }
  return null;
}

export function parseOverpassElements(json: any, aliases: ChainAlias[]): BranchInput[] {
  const out: BranchInput[] = [];
  for (const el of json?.elements ?? []) {
    const tags = el.tags || {};
    const m = matchChain(tags, aliases);
    if (!m) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || undefined;
    out.push({
      store_id: m.store_id,
      name: tags.name || m.chain,
      lat, lon,
      address,
      city: tags['addr:city'] || undefined,
      external_ref: `osm:${el.type}/${el.id}`,
      source: 'osm',
    });
  }
  return out;
}

export function buildOverpassQuery(areaName: string, aliases: ChainAlias[]): string {
  // Match any of the chains' brand/name within the named area.
  const names = aliases.flatMap(a => a.aliases).map(s => s.replace(/"/g, ''));
  const regex = names.join('|');
  return `[out:json][timeout:180];
area["name"="${areaName}"]["admin_level"="2"]->.a;
( node["shop"~"supermarket|convenience|grocery"]["name"~"${regex}",i](area.a);
  way["shop"~"supermarket|convenience|grocery"]["name"~"${regex}",i](area.a);
  node["shop"~"supermarket|convenience|grocery"]["brand"~"${regex}",i](area.a);
  way["shop"~"supermarket|convenience|grocery"]["brand"~"${regex}",i](area.a);
);
out center tags;`;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- overpass-parse`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add cheep-backend-express/src/config/store-brand-aliases.ts cheep-backend-express/src/services/overpass.service.ts cheep-backend-express/test/overpass-parse.test.ts cheep-backend-express/test/fixtures/overpass-tr-sample.json
git commit -m "feat(backend): Overpass brand-match + parse for store branches"
```

---

## Task 3: Nearest-branch helpers (pure) + nearby query

**Files:**
- Create: `cheep-backend-express/src/services/store-branch.service.ts`
- Create: `cheep-backend-express/test/store-branch.test.ts`

**Interfaces:**
- Produces:
  - `haversineKm(a: {lat:number;lon:number}, b: {lat:number;lon:number}): number`
  - `interface BranchLite { id: number; store_id: number; name: string; lat: number; lon: number; address: string|null; city: string|null }`
  - `nearestBranchPerStore(branches: BranchLite[], user: {lat:number;lon:number}): Array<{ store_id: number; branch: BranchLite; distanceKm: number }>` (one nearest branch per store_id, sorted by distance asc)
  - `resolveNearestBranchCoords(branches: BranchLite[], user: {lat:number;lon:number}): Map<number, {lat:number;lon:number}>` (store_id → nearest branch coords)
  - `getNearbyStores(countryId: number, user: {lat:number;lon:number}, limitPerStore?: number)` (DB: bbox prefilter → nearestBranchPerStore)

- [ ] **Step 1: Write the failing test**

Create `test/store-branch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { haversineKm, nearestBranchPerStore, resolveNearestBranchCoords, type BranchLite } from '../src/services/store-branch.service.js';

const branches: BranchLite[] = [
  { id: 1, store_id: 1, name: 'Migros İzmir', lat: 38.4192, lon: 27.1287, address: null, city: 'İzmir' },
  { id: 2, store_id: 1, name: 'Migros Mardin', lat: 37.3212, lon: 40.7245, address: null, city: 'Mardin' },
  { id: 3, store_id: 4, name: 'ŞOK Mardin', lat: 37.3100, lon: 40.7300, address: null, city: 'Mardin' },
];
const mardin = { lat: 37.3212, lon: 40.7433 };

describe('store-branch geo', () => {
  it('haversineKm: İzmir→Mardin is ~1000+ km, same point ~0', () => {
    expect(haversineKm(branches[0], branches[1])).toBeGreaterThan(900);
    expect(haversineKm(mardin, mardin)).toBeLessThan(0.001);
  });

  it('nearestBranchPerStore picks the Mardin branch for a Mardin user (NOT İzmir)', () => {
    const res = nearestBranchPerStore(branches, mardin);
    const migros = res.find(r => r.store_id === 1)!;
    expect(migros.branch.city).toBe('Mardin');
    expect(migros.distanceKm).toBeLessThan(5);
    // sorted ascending by distance
    expect(res[0].distanceKm).toBeLessThanOrEqual(res[res.length - 1].distanceKm);
  });

  it('resolveNearestBranchCoords maps store_id to nearest coords', () => {
    const m = resolveNearestBranchCoords(branches, mardin);
    expect(m.get(1)!.lat).toBeCloseTo(37.3212);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- store-branch`
Expected: FAIL — module not defined.

- [ ] **Step 3: Implement `store-branch.service.ts`**

```ts
import { prisma } from '../utils/prisma.client.js';

export interface BranchLite {
  id: number; store_id: number; name: string; lat: number; lon: number; address: string | null; city: string | null;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearestBranchPerStore(branches: BranchLite[], user: { lat: number; lon: number }) {
  const best = new Map<number, { store_id: number; branch: BranchLite; distanceKm: number }>();
  for (const b of branches) {
    const d = haversineKm(user, b);
    const cur = best.get(b.store_id);
    if (!cur || d < cur.distanceKm) best.set(b.store_id, { store_id: b.store_id, branch: b, distanceKm: d });
  }
  return Array.from(best.values()).sort((x, y) => x.distanceKm - y.distanceKm);
}

export function resolveNearestBranchCoords(branches: BranchLite[], user: { lat: number; lon: number }): Map<number, { lat: number; lon: number }> {
  const out = new Map<number, { lat: number; lon: number }>();
  for (const { store_id, branch } of nearestBranchPerStore(branches, user)) {
    out.set(store_id, { lat: branch.lat, lon: branch.lon });
  }
  return out;
}

/** DB: fetch country's branches near the user (bbox prefilter), then nearest-per-store. */
export async function getNearbyStores(countryId: number, user: { lat: number; lon: number }, deltaDeg = 1.0) {
  const rows = await prisma.storeBranch.findMany({
    where: {
      country_id: countryId,
      lat: { gte: user.lat - deltaDeg, lte: user.lat + deltaDeg },
      lon: { gte: user.lon - deltaDeg, lte: user.lon + deltaDeg },
    },
    select: { id: true, store_id: true, name: true, lat: true, lon: true, address: true, city: true },
  });
  return nearestBranchPerStore(rows as BranchLite[], user);
}

/** DB: nearest branch coords per given store within a country (for compare distance). */
export async function nearestBranchCoordsForStores(storeIds: number[], countryId: number, user: { lat: number; lon: number }) {
  const rows = await prisma.storeBranch.findMany({
    where: { country_id: countryId, store_id: { in: storeIds } },
    select: { id: true, store_id: true, name: true, lat: true, lon: true, address: true, city: true },
  });
  return resolveNearestBranchCoords(rows as BranchLite[], user);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- store-branch`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/services/store-branch.service.ts cheep-backend-express/test/store-branch.test.ts
git commit -m "feat(backend): nearest-branch geo helpers + nearby query"
```

---

## Task 4: `GET /stores/nearby` endpoint

**Files:**
- Modify: `cheep-backend-express/src/api/stores/stores.controller.ts`
- Modify: `cheep-backend-express/src/api/stores/stores.routes.ts`

**Interfaces:**
- Consumes: `getNearbyStores` (Task 3), `req.country?.id`.
- Produces: `GET /api/v1/stores/nearby?lat=&lon=` → `{ success, data: [{ store_id, distanceKm, branch: {id,name,lat,lon,address,city} }] }`.

- [ ] **Step 1: Add the controller handler**

In `stores.controller.ts` add:

```ts
import * as StoreBranchService from '../../services/store-branch.service.js';

export const getNearbyStores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            res.status(400).json({ success: false, message: 'lat ve lon zorunludur' });
            return;
        }
        const countryId = req.country?.id;
        if (!countryId) {
            res.status(200).json({ success: true, data: [] });
            return;
        }
        const nearby = await StoreBranchService.getNearbyStores(countryId, { lat, lon });
        res.status(200).json({
            success: true,
            data: nearby.map(n => ({
                store_id: n.store_id,
                distanceKm: Math.round(n.distanceKm * 10) / 10,
                branch: n.branch,
            })),
        });
    } catch (error) {
        next(error);
    }
};
```

- [ ] **Step 2: Register the route BEFORE `/:id`**

In `stores.routes.ts`, add above `router.get('/:id', ...)` (so `nearby` isn't captured as an id):

```ts
router.get('/nearby', StoreController.getNearbyStores);
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke (DB up, seed branches optional)**

Run backend (`npm run dev`) and: `curl -s -H "x-country: TR" "http://localhost:3000/api/v1/stores/nearby?lat=37.32&lon=40.74"`
Expected: `{"success":true,"data":[...]}` (empty array until Task 6 populates branches — that's fine here).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/api/stores/stores.controller.ts cheep-backend-express/src/api/stores/stores.routes.ts
git commit -m "feat(backend): GET /stores/nearby (country-scoped nearest branch per chain)"
```

---

## Task 5: Compare-engine uses nearest branch for distance

**Files:**
- Modify: `cheep-backend-express/src/services/compare-engine.service.ts`
- Test: `cheep-backend-express/test/compare-branch-distance.test.ts`

**Interfaces:**
- Consumes: `nearestBranchCoordsForStores` (Task 3), `options.userLocation`, `options.countryId`.
- Produces: when `userLocation` is present, distances are computed from each store's nearest branch coords (falling back to the store's own `lat/lon` when it has no branches).

- [ ] **Step 1: Write the failing test (pure override helper)**

Add an exported pure helper and test it. Create `test/compare-branch-distance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyBranchCoords } from '../src/services/compare-engine.service.js';

it('applyBranchCoords overrides store coords with nearest-branch coords when available', () => {
  const stores = [
    { id: 1, name: 'Migros', lat: 38.41, lon: 27.12 },   // İzmir placeholder
    { id: 9, name: 'NoBranch', lat: 40.0, lon: 30.0 },
  ];
  const branchCoords = new Map<number, {lat:number;lon:number}>([[1, { lat: 37.32, lon: 40.74 }]]);
  const out = applyBranchCoords(stores as any, branchCoords);
  expect(out.find(s => s.id === 1)!.lat).toBeCloseTo(37.32); // overridden to Mardin branch
  expect(out.find(s => s.id === 9)!.lat).toBeCloseTo(40.0);  // unchanged (no branch)
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- compare-branch-distance`
Expected: FAIL — `applyBranchCoords` not exported.

- [ ] **Step 3: Implement**

In `compare-engine.service.ts`, add the helper near `filterStorePricesByCountry`:

```ts
/** Verilen mağazaların koordinatlarını, elde varsa en yakın şube koordinatıyla değiştirir. */
export function applyBranchCoords<T extends { id: number; lat: number | null; lon: number | null }>(
    stores: T[],
    branchCoords: Map<number, { lat: number; lon: number }>
): T[] {
    return stores.map(s => {
        const b = branchCoords.get(s.id);
        return b ? { ...s, lat: b.lat, lon: b.lon } : s;
    });
}
```

Then in `compareShoppingList`, after `filterStorePricesByCountry(...)` and before strategies are computed, when `options.userLocation && options.countryId` resolve branch coords once and rewrite the store coords inside `itemOptions`' store objects. Concretely: collect the candidate store ids from `itemOptions`, call `nearestBranchCoordsForStores(ids, options.countryId, options.userLocation)`, and for each option's `store` apply the override (mutate `opt.store.lat/lon` via `applyBranchCoords` on the unique store list, then propagate). Add the import:

```ts
import { nearestBranchCoordsForStores } from './store-branch.service.js';
```

Minimal integration (after `itemOptions` is built, ~line 195):

```ts
    if (options.userLocation && options.countryId) {
        const ids = new Set<number>();
        itemOptions.forEach(m => m.forEach(opt => ids.add(opt.store_id)));
        const branchCoords = await nearestBranchCoordsForStores([...ids], options.countryId, options.userLocation);
        itemOptions.forEach(m => m.forEach(opt => {
            const b = branchCoords.get(opt.store_id);
            if (b) { opt.store.lat = b.lat; opt.store.lon = b.lon; }
        }));
    }
```

(The `StoreOption.store` objects flow into every strategy's distance math, so overriding here covers single- and multi-store routes.)

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- compare-branch-distance` then `npm test -- compare-country` (no regression).
Expected: PASS.

- [ ] **Step 5: Verify build + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add cheep-backend-express/src/services/compare-engine.service.ts cheep-backend-express/test/compare-branch-distance.test.ts
git commit -m "feat(backend): compare distance uses nearest branch coords"
```

---

## Task 6: Overpass ingestion script + populate branches

**Files:**
- Create: `cheep-backend-express/scripts/import-branches.ts`

**Interfaces:**
- Consumes: `buildOverpassQuery`, `parseOverpassElements` (Task 2), `BRAND_ALIASES`, `getCountryByCode`.
- Produces: CLI `tsx scripts/import-branches.ts <COUNTRY_CODE>` (default all) that fetches Overpass per country area, upserts `StoreBranch` by `external_ref`, logs per-chain counts.

- [ ] **Step 1: Implement the script**

```ts
import { prisma } from '../src/utils/prisma.client.js';
import { getCountryByCode } from '../src/utils/country.js';
import { BRAND_ALIASES } from '../src/config/store-brand-aliases.js';
import { buildOverpassQuery, parseOverpassElements } from '../src/services/overpass.service.js';

const AREA: Record<string, string> = { TR: 'Türkiye', CH: 'Schweiz/Suisse/Svizzera/Svizra', SE: 'Sverige', DE: 'Deutschland', PL: 'Polska' };
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

async function importCountry(code: string) {
  const aliases = BRAND_ALIASES[code];
  if (!aliases) { console.log(`skip ${code}: no aliases`); return; }
  const country = await getCountryByCode(code);
  const query = buildOverpassQuery(AREA[code], aliases);
  console.log(`[${code}] querying Overpass…`);
  const res = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) { console.error(`[${code}] Overpass ${res.status}`); return; }
  const json = await res.json();
  const branches = parseOverpassElements(json, aliases);
  let upserted = 0;
  for (const b of branches) {
    await prisma.storeBranch.upsert({
      where: { external_ref: b.external_ref },
      update: { name: b.name, lat: b.lat, lon: b.lon, address: b.address ?? null, city: b.city ?? null },
      create: { store_id: b.store_id, country_id: country.id, name: b.name, lat: b.lat, lon: b.lon, address: b.address ?? null, city: b.city ?? null, source: 'osm', external_ref: b.external_ref },
    });
    upserted++;
  }
  const byChain = aliases.map(a => `${a.chain}:${branches.filter(b => b.store_id === a.store_id).length}`).join(', ');
  console.log(`[${code}] upserted ${upserted} branches (${byChain})`);
}

const arg = process.argv[2]?.toUpperCase();
const codes = arg ? [arg] : Object.keys(BRAND_ALIASES);
for (const c of codes) { await importCountry(c); }
await prisma.$disconnect();
```

- [ ] **Step 2: Run it for Turkey (live network; may take a minute)**

Run: `cd cheep-backend-express && npx tsx scripts/import-branches.ts TR`
Expected: logs `[TR] upserted <N> branches (Migros:.., CarrefourSA:.., A101:.., ŞOK:..)` with N in the hundreds/thousands. If Overpass rate-limits/times out, wait and retry, or set `OVERPASS_URL` to a mirror (e.g. `https://overpass.kumi.systems/api/interpreter`). **If a chain shows 0**, note it (OSM gap) for the locator-scrape fallback (Sub-project B); do not block.

- [ ] **Step 3: Verify branches landed + a Mardin query works**

Run:
```bash
curl -s -H "x-country: TR" "http://localhost:3000/api/v1/stores/nearby?lat=37.3212&lon=40.7433" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.data.map(x=>x.store_id+':'+x.branch.city+':'+x.distanceKm+'km'))})"
```
Expected: the nearest branches are in/near Mardin (small km), NOT İzmir — the bug's root condition is fixed for real data.

- [ ] **Step 4: Run the other countries (best-effort)**

Run: `npx tsx scripts/import-branches.ts` (all). Log which chains returned 0 (OSM gaps) as follow-ups.

- [ ] **Step 5: Commit the script**

```bash
git add cheep-backend-express/scripts/import-branches.ts
git commit -m "feat(backend): Overpass branch ingestion CLI (free, all countries)"
```

---

## Task 7: Mobile — send location to compare + nearby + honest permission copy

**Files:**
- Modify: `Cheep-Mobile/src/types/index.ts` (CompareRequest, NearbyStore)
- Modify: `Cheep-Mobile/src/constants/api.ts` (STORES.NEARBY)
- Modify: `Cheep-Mobile/src/services/store.service.ts` (getNearbyStores)
- Modify: `Cheep-Mobile/src/screens/lists/CompareResultsScreen.tsx` (send userLocation)
- Modify: `Cheep-Mobile/app.json` (permission copy)

**Interfaces:**
- Consumes: `getUserLocation()` (`src/utils/geo.ts`, returns `{lat, lon} | null`), `haversineKm`/`formatDistance` (already in geo.ts).
- Produces: compare requests carry `userLocation`; `storeService.getNearbyStores(lat, lon)`.

- [ ] **Step 1: Add endpoint + types**

`api.ts` STORES:
```ts
  STORES: {
    ALL: '/stores',
    BY_ID: (id: number) => `/stores/${id}`,
    NEARBY: '/stores/nearby',
  },
```
`types/index.ts` — add `userLocation?: { lat: number; lon: number }` to `CompareRequest`; add:
```ts
export interface NearbyStore {
  store_id: number;
  distanceKm: number;
  branch: { id: number; name: string; lat: number; lon: number; address: string | null; city: string | null };
}
```

- [ ] **Step 2: storeService.getNearbyStores**

```ts
async getNearbyStores(lat: number, lon: number): Promise<NearbyStore[]> {
  const response = await apiClient.get<ApiResponse<NearbyStore[]>>(
    API_ENDPOINTS.STORES.NEARBY, { params: { lat, lon } }
  );
  return response.data.data || [];
}
```
(import `NearbyStore` from types.)

- [ ] **Step 3: Send userLocation from CompareResultsScreen**

In the compare effect (CompareResultsScreen.tsx ~line 48), fetch location first and include it:
```ts
const loc = await getUserLocation();           // {lat,lon} | null
const data = await listService.compareList(listId, {
  maxStores: 3,
  includeMissingProducts: true,
  ...(loc ? { userLocation: loc } : {}),
});
```
Add `import { getUserLocation } from '../../utils/geo';`. Failure/denied → `loc` is null → compare works exactly as before (distances hidden).

- [ ] **Step 4: Honest permission copy**

In `app.json`, keep the location plugin but ensure the string is truthful (it now genuinely powers nearest-branch distances):
`"locationWhenInUsePermission": "Cheep, sana en yakın market şubelerini ve gerçek mesafeleri göstermek için konumunu kullanır."`

- [ ] **Step 5: Verify**

Run: `cd Cheep-Mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Cheep-Mobile/src/types/index.ts Cheep-Mobile/src/constants/api.ts Cheep-Mobile/src/services/store.service.ts Cheep-Mobile/src/screens/lists/CompareResultsScreen.tsx Cheep-Mobile/app.json
git commit -m "feat(mobile): send location to compare + nearby stores + honest permission copy"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** StoreBranch model → T1; OSM source+brand match+ingestion → T2/T6; nearby endpoint → T4; compare uses branches → T5; mobile sends location + nearby + permission copy → T7. Locator-scrape fallback is explicitly deferred to Sub-project B (spec §2/§6) — noted where a chain returns 0.
- **Placeholder scan:** none — every code step has code; T6 live-run has an explicit fallback (mirror URL, note-0-and-continue) rather than a vague "handle errors."
- **Type consistency:** `BranchLite`, `nearestBranchPerStore`, `resolveNearestBranchCoords`, `nearestBranchCoordsForStores`, `getNearbyStores`, `applyBranchCoords`, `BranchInput`, `matchChain`, `parseOverpassElements`, `buildOverpassQuery`, `BRAND_ALIASES`, `NearbyStore` are used consistently across tasks. `external_ref` format `osm:<type>/<id>` matches between parse (T2) and fixture/test.
- **Country scoping:** nearby (T4) and compare branch-resolution (T5) both filter by `country_id`/`req.country.id`; StoreBranch carries `country_id`. No cross-country leak.
- **Known follow-ups (not blockers):** chains with 0 OSM coverage → locator scraping (Sub-project B); optional Home "nearest stores" UI surface beyond compare (can add later using `getNearbyStores`).
