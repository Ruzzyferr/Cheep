# Poland Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch Cheep in Poland: 4 chains (Biedronka 44, Lidl 45, Żabka 47, Auchan 41) scraped and ingested with zero wrong cross-store merges, correct categories, location-based TR/PL country selection, OSM branch locations, and a self-refreshing weekly pipeline.

**Architecture:** Country abstraction already exists end-to-end (DB `Country`, `x-country` header, `countries/poland/` scrapers, `pl.json` locale). This plan adds: evidence-gated matching (EAN via Open Food Facts enrichment > deterministic fingerprint > LLM/fuzzy proposals that NEVER auto-merge), a `MatchProposal` review queue + audit CLI, category-slug ingestion, PL units, OSM branches, assistant reply language, TR/PL-only pickers, and the Turkey-style scheduled refresh with guardrails.

**Tech Stack:** Express 5 + TypeScript ESM + Prisma/PostgreSQL + vitest (backend, `cheep-backend-express/`); Python 3.10 + requests + pytest (scraper, `Cheep-Scraper/`); React Native/Expo (mobile, `Cheep-Mobile/`); systemd on the droplet (`deploy/`).

## Global Constraints

- **Zero-error invariant:** for strict countries (env `STRICT_MATCH_COUNTRY_CODES`, default `PL`) a product may auto-merge ONLY on (a) country-scoped EAN equality or (b) identical fingerprint (`muadil_grup_id`). Fuzzy similarity NEVER auto-merges in strict countries — it creates a pending `MatchProposal`.
- User-visible countries: **TR and PL only** (CH/SE/DE stay in DB/seed, hidden from pickers and geo-detect).
- Backend imports are ESM: local imports end in `.js` even in `.ts` files.
- Backend tests: `cheep-backend-express/test/*.test.ts`, run with `npm test` (vitest) from `cheep-backend-express/`.
- Scraper tests: `Cheep-Scraper/tests/test_*.py`, run with `python -m pytest tests/<file> -v` from `Cheep-Scraper/`. Scraper `parse()` tests use fixtures, never the network.
- Prisma migrations: `npx prisma migrate dev --name <name>` from `cheep-backend-express/` (needs local Postgres per `.env`).
- Commit style: conventional commits (`feat(scope): …`, `fix: …`), matching repo history.
- PL store IDs are fixed: Carrefour 40 (disabled), Auchan 41, Biedronka 44, Lidl 45, Żabka 47.

---

### Task 1: Polish diacritics in backend text normalization

Polish letters (ł ą ć ę ń ó ś ż ź) currently fall through `baseNormalize` into the `[^\w\s]` strip, so `Łaciate` → `aciate` while a chain spelling it `Laciate` → `laciate` — same product, two fingerprints. Fold PL diacritics to ASCII the same way Turkish is handled.

**Files:**
- Modify: `cheep-backend-express/src/api/products/product-matcher.service.ts` (function `baseNormalize`, lines 50-69)
- Test: `cheep-backend-express/test/product-fingerprint-pl.test.ts`

**Interfaces:**
- Produces: unchanged signature `generateProductFingerprint({name, brand?}): string` — now diacritic-stable for PL. All later matching tasks rely on this.

- [ ] **Step 1: Write the failing test**

```ts
// cheep-backend-express/test/product-fingerprint-pl.test.ts
import { describe, it, expect } from 'vitest';
import { generateProductFingerprint } from '../src/api/products/product-matcher.service.js';

describe('Polish diacritics in fingerprint', () => {
  it('folds diacritics so both chain spellings match', () => {
    const a = generateProductFingerprint({ name: 'Mleko Łaciate świeże 2% 1L', brand: 'Łaciate' });
    const b = generateProductFingerprint({ name: 'Mleko Laciate swieze 2% 1l', brand: 'Laciate' });
    expect(a).toBe(b);
    expect(a).toContain('laciate');
  });

  it('keeps different sizes apart (gramaj in fingerprint)', () => {
    const a = generateProductFingerprint({ name: 'Mleko Łaciate 2% 1L' });
    const b = generateProductFingerprint({ name: 'Mleko Łaciate 2% 0,5L' });
    expect(a).not.toBe(b);
  });

  it('folds ż/ź/ó/ą/ę/ć/ń/ś', () => {
    const a = generateProductFingerprint({ name: 'Żółty ser dojrzewający Śnieżka' });
    const b = generateProductFingerprint({ name: 'Zolty ser dojrzewajacy Sniezka' });
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `cheep-backend-express/`): `npx vitest run test/product-fingerprint-pl.test.ts`
Expected: FAIL — fingerprints differ (`aciate` vs `laciate`).

- [ ] **Step 3: Add Polish replacements to baseNormalize**

In `product-matcher.service.ts`, inside `baseNormalize`, after the Turkish uppercase replacements (`.replace(/Ç/g, 'c')`) and BEFORE `.replace(/[^\w\s]/g, ' ')`, insert:

```ts
        // Lehçe diyakritikler — iki zincir aynı ürünü farklı yazsa da aynı
        // fingerprint'e düşsün (toLowerCase zaten uygulandı, küçük harf yeter).
        .replace(/ł/g, 'l')
        .replace(/ą/g, 'a')
        .replace(/ć/g, 'c')
        .replace(/ę/g, 'e')
        .replace(/ń/g, 'n')
        .replace(/ó/g, 'o')
        .replace(/ś/g, 's')
        .replace(/ż/g, 'z')
        .replace(/ź/g, 'z')
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/product-fingerprint-pl.test.ts` → PASS.
Then run the full suite to catch regressions: `npm test` → all green (existing `product-fingerprint.test.ts` must still pass).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/api/products/product-matcher.service.ts cheep-backend-express/test/product-fingerprint-pl.test.ts
git commit -m "feat(matching): fold Polish diacritics in product fingerprint normalization"
```

---

### Task 2: MatchProposal model + strict no-fuzzy-auto-merge for PL

`findOrCreateProduct` currently auto-merges on fuzzy similarity ≥ 0.85 (`product-matcher.service.ts:271-289`). For strict countries this must become a *proposal*, not a merge.

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma` (add model)
- Modify: `cheep-backend-express/src/api/products/product-matcher.service.ts`
- Test: `cheep-backend-express/test/product-matcher-strict.test.ts`

**Interfaces:**
- Produces: Prisma model `MatchProposal` (`match_proposals` table): `{ id, country_id, product_id, candidate_product_id, similarity: Float, evidence: 'fuzzy'|'llm', status: 'pending'|'approved'|'rejected', created_at, updated_at }`, `@@unique([product_id, candidate_product_id])`.
- Produces: `isStrictCountry(countryId?: number): Promise<boolean>` exported from `product-matcher.service.ts` (used by Task 8 tooling and future LLM-tier callers).
- Consumes: Task 1's diacritic-stable fingerprint.

- [ ] **Step 1: Add the model to schema.prisma**

Append to `cheep-backend-express/prisma/schema.prisma`:

```prisma
// ============================================
// EŞLEŞTİRME TEKLİF KUYRUĞU (sıfır-hata ülkeleri)
// ============================================
// Strict ülkelerde (PL) fuzzy/LLM eşleşmeleri OTOMATİK BİRLEŞMEZ; buraya
// teklif olarak düşer. CLI (scripts/match-review.ts) onaylarsa mergeProducts
// çalışır. product_id = yeni (birleşmemiş) ürün, candidate_product_id = aday.
model MatchProposal {
  id                   Int      @id @default(autoincrement())
  country_id           Int
  product_id           Int
  candidate_product_id Int
  similarity           Float
  evidence             String   // 'fuzzy' | 'llm'
  status               String   @default("pending") // pending | approved | rejected
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  @@unique([product_id, candidate_product_id])
  @@index([status])
  @@index([country_id])
  @@map("match_proposals")
}
```

- [ ] **Step 2: Create the migration**

Run (from `cheep-backend-express/`): `npx prisma migrate dev --name add_match_proposal`
Expected: new folder under `prisma/migrations/` with `CREATE TABLE "match_proposals"`; `npx prisma generate` runs automatically.

- [ ] **Step 3: Write the failing test**

```ts
// cheep-backend-express/test/product-matcher-strict.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  product: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  matchProposal: { create: vi.fn() },
  country: { findUnique: vi.fn() },
};
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/utils/country.js', () => ({
  getCountryIdByCode: vi.fn(async (code?: string) => (code === 'PL' ? 5 : 1)),
}));

process.env.STRICT_MATCH_COUNTRY_CODES = 'PL';
const { productMatcher, __setStrictCountryIdsForTest } = await import('../src/api/products/product-matcher.service.js');

describe('strict-country matching (PL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setStrictCountryIdsForTest(new Set([5]));
  });

  it('fuzzy candidate does NOT merge; creates product + pending proposal', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null); // no fingerprint match
    // one very similar existing candidate (same gramaj, sim >= 0.85)
    prismaMock.product.findMany.mockResolvedValue([
      { id: 900, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', muadil_grup_id: 'x' },
    ]);
    prismaMock.product.create.mockResolvedValue({ id: 901, name: 'Mleko Łaciate UHT 3,2% 1L' });

    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'Mleko Łaciate UHT 3,2% 1L', brand: 'Łaciate', country_id: 5,
    });

    expect(isNew).toBe(true);
    expect(product.id).toBe(901);
    expect(prismaMock.matchProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          country_id: 5, product_id: 901, candidate_product_id: 900,
          evidence: 'fuzzy', status: 'pending',
        }),
      }),
    );
  });

  it('non-strict country (TR) keeps legacy fuzzy auto-merge', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([
      { id: 700, name: 'Pınar Süt 1L', brand: 'Pınar', muadil_grup_id: 'y' },
    ]);
    prismaMock.product.findUnique.mockResolvedValue({ id: 700, name: 'Pınar Süt 1L', muadil_grup_id: 'y' });
    prismaMock.product.update.mockResolvedValue({ id: 700 });

    const { isNew } = await productMatcher.findOrCreateProduct({
      name: 'Pinar Süt 1L', brand: 'Pınar', country_id: 1,
    });
    expect(isNew).toBe(false);
    expect(prismaMock.matchProposal.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run test/product-matcher-strict.test.ts`
Expected: FAIL (`__setStrictCountryIdsForTest` not exported; proposal never created — PL fuzzy candidate merges).

- [ ] **Step 5: Implement strict mode in product-matcher.service.ts**

Add near the top of the file (after imports):

```ts
// Sıfır-hata ülkeleri: fuzzy benzerlik ASLA otomatik birleşmez, MatchProposal yazılır.
const STRICT_CODES = (process.env.STRICT_MATCH_COUNTRY_CODES ?? 'PL')
    .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

let strictIdsCache: Set<number> | null = null;
export function __setStrictCountryIdsForTest(ids: Set<number>) { strictIdsCache = ids; }

async function getStrictCountryIds(): Promise<Set<number>> {
    if (!strictIdsCache) {
        const ids = await Promise.all(STRICT_CODES.map(c => getCountryIdByCode(c)));
        strictIdsCache = new Set(ids.filter((x): x is number => typeof x === 'number'));
    }
    return strictIdsCache;
}

export async function isStrictCountry(countryId?: number): Promise<boolean> {
    if (typeof countryId !== 'number') return false;
    return (await getStrictCountryIds()).has(countryId);
}
```

Then replace the fuzzy auto-merge block in `findOrCreateProduct` (the block starting `const candidates = await this.findSimilarProducts(...)` through the `if (bestMatch) { ... return { product, isNew: false }; }` close) with:

```ts
        const candidates = await this.findSimilarProducts(data, resolvedCountryId);
        // STRICT: gramajı eşleşmeyen aday ASLA otomatik birleşmez (0.85 fuzzy dahil).
        const incomingGramaj = extractGramaj(data.name);
        const bestMatch = candidates.find(
            c => c.similarity >= 0.85 && extractGramaj(c.name) === incomingGramaj
        );

        const strict = await isStrictCountry(resolvedCountryId);
        if (bestMatch && !strict) {
            const product = await prisma.product.findUnique({
                where: { id: bestMatch.id },
            });
            if (product && (!product.muadil_grup_id || product.muadil_grup_id !== fingerprint)) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: { muadil_grup_id: fingerprint },
                });
                product.muadil_grup_id = fingerprint;
            }
            return { product, isNew: false };
        }
```

Finally, at the end of `findOrCreateProduct`, after `const newProduct = await prisma.product.create({...})` and before `return { product: newProduct, isNew: true };`, insert:

```ts
        // Strict ülke: birleşmedik ama güçlü aday(lar) var → inceleme teklifi yaz.
        // Teklif yazımı ingest'i asla düşürmemeli (best-effort).
        if (strict && resolvedCountryId) {
            for (const c of candidates.filter(c => c.similarity >= 0.70).slice(0, 3)) {
                try {
                    await prisma.matchProposal.create({
                        data: {
                            country_id: resolvedCountryId,
                            product_id: newProduct.id,
                            candidate_product_id: c.id,
                            similarity: c.similarity,
                            evidence: 'fuzzy',
                            status: 'pending',
                        },
                    });
                } catch { /* @@unique çakışması vb. — sessiz geç */ }
            }
        }
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run test/product-matcher-strict.test.ts` → PASS. Then `npm test` → full suite green (TR behavior unchanged — `product-matcher-country-scope.test.ts`, `product-ean-match.test.ts` must pass).

- [ ] **Step 7: Commit**

```bash
git add cheep-backend-express/prisma/schema.prisma cheep-backend-express/prisma/migrations cheep-backend-express/src/api/products/product-matcher.service.ts cheep-backend-express/test/product-matcher-strict.test.ts
git commit -m "feat(matching): MatchProposal queue; strict countries never fuzzy-auto-merge"
```

---

### Task 3: raw_name on StorePrice + PL units in the ingest schema

The audit tool (Task 8) must show each chain's ORIGINAL scraped name side-by-side; today only the canonical `Product.name` survives. Also the Joi unit whitelist rejects Polish units.

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma` (StorePrice)
- Modify: `cheep-backend-express/src/api/store-prices/store-prices.service.ts`
- Modify: `cheep-backend-express/src/api/store-prices/store-price.schema.ts:15`
- Test: `cheep-backend-express/test/store-price-pl.test.ts`

**Interfaces:**
- Produces: `StorePrice.raw_name: String?` — set to the incoming payload `name` on every upsert. Task 8's audit reads it.
- Produces: Joi `unit` whitelist now also accepts `'szt'`, `'opak'`.

- [ ] **Step 1: Schema + migration**

In `schema.prisma` model `StorePrice`, after the `unit` field add:

```prisma
  raw_name         String? // Zincirin orijinal ürün adı (audit: birleşme doğrulama)
```

Run: `npx prisma migrate dev --name store_price_raw_name`

- [ ] **Step 2: Write the failing test**

```ts
// cheep-backend-express/test/store-price-pl.test.ts
import { describe, it, expect } from 'vitest';
import { upsertStorePriceSchema } from '../src/api/store-prices/store-price.schema.js';

describe('PL ingest schema', () => {
  it('accepts szt and opak units', () => {
    for (const unit of ['szt', 'opak']) {
      const { error } = upsertStorePriceSchema.validate({
        store_id: 44, store_sku: 'x1', price: '4.99', unit, name: 'Mleko 1L',
      });
      expect(error).toBeUndefined();
    }
  });

  it('still rejects unknown units', () => {
    const { error } = upsertStorePriceSchema.validate({
      store_id: 44, store_sku: 'x1', price: '4.99', unit: 'stück', name: 'Mleko 1L',
    });
    expect(error).toBeDefined();
  });
});
```

Note: check the actual export name in `store-price.schema.ts` — if the single-item schema has a different name, import that; the `unit` line is `store-price.schema.ts:15`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/store-price-pl.test.ts` → FAIL (`szt` rejected).

- [ ] **Step 4: Implement**

`store-price.schema.ts:15` becomes:

```ts
    unit: Joi.string().valid('adet', 'kg', 'g', 'l', 'ml', 'cl', 'paket', 'kutu', 'szt', 'opak').default('adet'),
```

In `store-prices.service.ts` `upsertStorePrice`, thread `raw_name` into all three writes. In the `existingByProduct` update `data`, the upsert `create`, and the upsert `update` blocks add:

```ts
                raw_name: productData.name,
```

- [ ] **Step 5: Run tests**

`npx vitest run test/store-price-pl.test.ts` → PASS; `npm test` → green.

- [ ] **Step 6: Commit**

```bash
git add cheep-backend-express/prisma cheep-backend-express/src/api/store-prices cheep-backend-express/test/store-price-pl.test.ts
git commit -m "feat(ingest): store raw scraped name per store price; accept PL units szt/opak"
```

---

### Task 4: category_slug support in ingest (backend)

PL categories are mapped scraper-side to canonical slugs (`countries/poland/category_map.json` already maps e.g. `"Nabiał i jaja" → "dairy-eggs"`), but the payload only carries numeric `category_id`, which scrapers can't know. Accept `category_slug` and resolve it server-side.

**Files:**
- Modify: `cheep-backend-express/src/api/store-prices/store-prices.service.ts` (UpsertData)
- Modify: `cheep-backend-express/src/api/store-prices/store-price.schema.ts`
- Modify: `cheep-backend-express/src/api/products/product-matcher.service.ts` (`findOrCreateProduct`)
- Test: `cheep-backend-express/test/product-category-slug.test.ts`

**Interfaces:**
- Produces: bulk-upsert payload items may carry `category_slug?: string`; resolved to `Category.id` via `prisma.category.findUnique({ where: { slug } })` with an in-memory cache. On create → sets `category_id`; on existing product with NULL `category_id` → backfills. Task 6 (scraper) sends this field.

- [ ] **Step 1: Write the failing test**

```ts
// cheep-backend-express/test/product-category-slug.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  product: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  category: { findUnique: vi.fn() },
  matchProposal: { create: vi.fn() },
};
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/utils/country.js', () => ({ getCountryIdByCode: vi.fn(async () => 5) }));

const { productMatcher } = await import('../src/api/products/product-matcher.service.js');

describe('category_slug resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves slug to category_id on create', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.category.findUnique.mockResolvedValue({ id: 12, slug: 'dairy-eggs' });
    prismaMock.product.create.mockResolvedValue({ id: 1 });

    await productMatcher.findOrCreateProduct({
      name: 'Mleko 1L', country_id: 5, category_slug: 'dairy-eggs',
    });

    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category_id: 12 }) }),
    );
  });

  it('unknown slug → category_id stays null (no throw)', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.category.findUnique.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 2 });

    await expect(productMatcher.findOrCreateProduct({
      name: 'Chleb', country_id: 5, category_slug: 'no-such-slug',
    })).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run test/product-category-slug.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`store-prices.service.ts` `UpsertData` add: `category_slug?: string;` (it flows via `...productData`).

`store-price.schema.ts`: add to the item schema: `category_slug: Joi.string().max(120).optional(),`

`product-matcher.service.ts`: add module-level cache + resolver:

```ts
const categorySlugCache = new Map<string, number | null>();
async function resolveCategorySlug(slug?: string): Promise<number | null> {
    if (!slug) return null;
    if (categorySlugCache.has(slug)) return categorySlugCache.get(slug)!;
    const cat = await prisma.category.findUnique({ where: { slug } });
    const id = cat?.id ?? null;
    categorySlugCache.set(slug, id);
    return id;
}
```

In `findOrCreateProduct`: add `category_slug?: string;` to the `data` param type. At the start (after `providedCategoryId` is computed):

```ts
        const slugCategoryId = providedCategoryId ?? (await resolveCategorySlug(data.category_slug));
```

Use `slugCategoryId` wherever `providedCategoryId` is used for the EAN-path patch and pass `category_id: slugCategoryId ?? categoryId` in BOTH `prisma.product.create` calls (EAN path and final path). In the EAN-existing patch, also backfill when the existing product has no category: `if (slugCategoryId !== null && existingByEan.category_id == null) patch.category_id = slugCategoryId;`

- [ ] **Step 4: Run tests** — target test PASS, `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src cheep-backend-express/test/product-category-slug.test.ts
git commit -m "feat(ingest): resolve category_slug server-side for foreign scrapers"
```

---

### Task 5: Scraper — Polish units + per-country default unit

`units.py` doesn't know `szt`/`opak`/`litr`; `foreign_import.py` clamps unknown units to Turkish `adet`. PL rows must default to `szt`, never `adet`.

**Files:**
- Modify: `Cheep-Scraper/scrapers/units.py`
- Modify: `Cheep-Scraper/countries/_common/foreign_import.py`
- Modify: `Cheep-Scraper/countries/_common/pipeline.py`
- Modify: `Cheep-Scraper/countries/poland/config.json` (add `"default_unit": "szt"`)
- Test: `Cheep-Scraper/tests/test_pl_units.py`

**Interfaces:**
- Produces: `parse_quantity_and_unit("Jaja 10 szt.") == (10.0, "szt")`; `normalize_unit("opakowanie") == "opak"`.
- Produces: `build_api_payloads(products, store_id, category_map=None, default_unit="adet")` — new kwarg; `ForeignImporter.import_products(..., default_unit="adet")` threads it. `pipeline.py` reads `config["default_unit"]`.

- [ ] **Step 1: Write the failing test**

```python
# Cheep-Scraper/tests/test_pl_units.py
from scrapers.units import parse_quantity_and_unit, normalize_unit
from countries._common.foreign_import import build_api_payloads


def test_polish_unit_tokens():
    assert parse_quantity_and_unit("Jaja z wolnego wybiegu 10 szt.") == (10.0, "szt")
    assert parse_quantity_and_unit("Mleko UHT 1,5 l") == (1.5, "l")
    assert normalize_unit("sztuk") == "szt"
    assert normalize_unit("opakowanie") == "opak"


def test_default_unit_is_country_scoped():
    products = [{"name": "Bułka kajzerka", "price": 0.89}]  # unit yok
    payloads = build_api_payloads(products, store_id=44, default_unit="szt")
    assert payloads[0]["unit"] == "szt"


def test_adet_never_leaks_into_pl_rows():
    products = [{"name": "Masło ekstra", "price": 7.99, "unit": "adet"}]
    payloads = build_api_payloads(products, store_id=44, default_unit="szt")
    assert payloads[0]["unit"] == "szt"
```

- [ ] **Step 2: Run to verify it fails** — from `Cheep-Scraper/`: `python -m pytest tests/test_pl_units.py -v` → FAIL.

- [ ] **Step 3: Implement units.py**

In `_UNIT_MAP` add:

```python
    "szt": "szt", "szt.": "szt", "sztuk": "szt", "sztuki": "szt", "sztuka": "szt",
    "opak": "opak", "opak.": "opak", "opakowanie": "opak", "opakowania": "opak",
    "litr": "l", "litry": "l", "litrów": "l",
```

In `_UNIT_TOKENS` insert (longest-first): `"opakowanie", "opakowania", "sztuki", "sztuka", "sztuk", "litrów", "litry", "litr", "opak", "szt"` — place all of them BEFORE the existing `"adet"` entry (they are longer or equal; keep `"g", "l"` last).

In `compute_unit_price`, extend the piece-count branch so `szt` behaves like `adet` (per-piece): change `else:` branch comment and keep behavior (falls through to `base_unit = "adet"` is WRONG for PL display — instead):

```python
    else:  # adet, szt, paket, kutu, opak, rulo, ...
        base_qty, base_unit = q, u if u in ("adet", "szt") else "adet"
```

- [ ] **Step 4: Implement foreign_import.py + pipeline.py**

`ALLOWED_UNITS` becomes:

```python
ALLOWED_UNITS = {"adet", "kg", "g", "l", "ml", "cl", "paket", "kutu", "szt", "opak"}
```

`build_api_payloads` signature: `def build_api_payloads(products, store_id, category_map=None, default_unit="adet"):` and the unit block becomes:

```python
        unit = (product.get("unit") or default_unit).lower()
        if unit not in ALLOWED_UNITS:
            unit = default_unit
        if unit == "adet" and default_unit != "adet":
            # Türkçe fallback yabancı ülke satırına sızmasın (spec: sıfır 'adet' PL'de)
            unit = default_unit
```

`ForeignImporter.import_products(self, products, store_id, category_map=None, default_unit="adet")` → pass through to `build_api_payloads`.

`pipeline.py` in `run_country_pipeline`, read once after loading config: `default_unit = config.get("default_unit", "adet")` and call `importer.import_products(products, store_id=r["store_id"], category_map=category_map, default_unit=default_unit)`.

`countries/poland/config.json`: add top-level `"default_unit": "szt",` after `"country_code": "PL",`.

- [ ] **Step 5: Run tests** — `python -m pytest tests/test_pl_units.py tests/test_unit_parser.py tests/test_foreign_import.py -v` → all PASS (TR behavior unchanged: no `default_unit` → `adet`).

- [ ] **Step 6: Commit**

```bash
git add Cheep-Scraper/scrapers/units.py Cheep-Scraper/countries/_common Cheep-Scraper/countries/poland/config.json Cheep-Scraper/tests/test_pl_units.py
git commit -m "feat(scraper): Polish units (szt/opak/litr) + per-country default unit"
```

---

### Task 6: Scraper — actually send category_slug from category_map

`build_api_payloads` receives `category_map` but never uses it (verified: `foreign_import.py:26-72`). Wire it, and grow the PL map for the pilot categories.

**Files:**
- Modify: `Cheep-Scraper/countries/_common/foreign_import.py`
- Modify: `Cheep-Scraper/countries/poland/category_map.json`
- Test: `Cheep-Scraper/tests/test_category_slug_payload.py`

**Interfaces:**
- Consumes: Task 4's backend `category_slug` field.
- Produces: payload items carry `category_slug` when `raw_category` (or `category`) resolves via the country's `category_map.json`.

- [ ] **Step 1: Write the failing test**

```python
# Cheep-Scraper/tests/test_category_slug_payload.py
from countries._common.foreign_import import build_api_payloads


def test_category_map_resolves_to_slug():
    products = [{"name": "Mleko Łaciate 1L", "price": 4.59, "raw_category": "Nabiał i jaja"}]
    cmap = {"Nabiał i jaja": "dairy-eggs"}
    payloads = build_api_payloads(products, store_id=44, category_map=cmap)
    assert payloads[0]["category_slug"] == "dairy-eggs"


def test_unmapped_category_omitted():
    products = [{"name": "Znicz duży", "price": 9.99, "raw_category": "Dekoracje"}]
    payloads = build_api_payloads(products, store_id=44, category_map={"Nabiał i jaja": "dairy-eggs"})
    assert "category_slug" not in payloads[0]
```

- [ ] **Step 2: Run to verify it fails** — `python -m pytest tests/test_category_slug_payload.py -v` → FAIL.

- [ ] **Step 3: Implement**

In `build_api_payloads`, after the `image_url` block add:

```python
        raw_cat = (product.get("raw_category") or product.get("category") or "").strip()
        if category_map and raw_cat:
            slug = category_map.get(raw_cat)
            if slug:
                payload["category_slug"] = slug
```

- [ ] **Step 4: Expand the PL category map for pilot categories**

First list the canonical slugs that exist in the DB (from `cheep-backend-express/`):

```bash
npx tsx -e "import {prisma} from './src/utils/prisma.client.js'; const c = await prisma.category.findMany({select:{slug:true,name:true}, orderBy:{slug:'asc'}}); console.log(c.map(x=>x.slug+'\t'+x.name).join('\n')); process.exit(0)"
```

Then extend `countries/poland/category_map.json` so every pilot category from all 4 chains maps to an EXISTING slug. Chains' raw category strings come from the fixtures: run `python -m pytest tests/test_pl_scrapers.py -v` then inspect distinct `raw_category` values per fixture with:

```bash
python -c "
import json, sys
sys.path.insert(0, '.')
from countries.poland.scrapers.biedronka import BiedronkaScraper
html = open('countries/poland/fixtures/biedronka_sample.html', encoding='utf-8').read()
print(sorted({p.raw_category for p in BiedronkaScraper().parse(html) if p.raw_category}))
"
```

(repeat the same pattern for `lidl_pl`, `zabka`, `auchan_pl` with their fixtures/parse entry points — check each scraper file for its exact `parse` signature). Every raw value seen in pilot scrapes must be a key in `category_map.json`; map to the closest canonical slug. Commit the expanded map.

- [ ] **Step 5: Run tests** — `python -m pytest tests/test_category_slug_payload.py tests/test_category_map.py -v` → PASS.

- [ ] **Step 6: Commit**

```bash
git add Cheep-Scraper/countries/_common/foreign_import.py Cheep-Scraper/countries/poland/category_map.json Cheep-Scraper/tests/test_category_slug_payload.py
git commit -m "feat(scraper): send category_slug from country category_map (PL pilot coverage)"
```

---

### Task 7: Open Food Facts EAN enrichment

PL chains expose no EAN. OFF's open database resolves (brand, name, quantity) → EAN for well-known products. STRICT acceptance: exactly one candidate passing brand+quantity+name checks; anything ambiguous → no EAN (falls to fingerprint tier). SQLite cache so weekly reruns don't re-query.

**Files:**
- Create: `Cheep-Scraper/countries/_common/off_enrich.py`
- Modify: `Cheep-Scraper/countries/_common/pipeline.py`
- Modify: `Cheep-Scraper/countries/poland/config.json` (add `"off_enrich": true`)
- Test: `Cheep-Scraper/tests/test_off_enrich.py`

**Interfaces:**
- Produces: `OffEnricher(country_code: str, cache_path: str, session=None)` with `enrich(products: List[Dict]) -> Dict` (stats: `{looked_up, cache_hits, enriched, ambiguous, misses}`). Mutates `product["barcode"]` in place ONLY on confident hits.
- Consumes: `scrapers.units.parse_quantity_and_unit` for quantity equality.

- [ ] **Step 1: Write the failing test**

```python
# Cheep-Scraper/tests/test_off_enrich.py
import json
from countries._common.off_enrich import OffEnricher


class FakeResp:
    def __init__(self, payload): self._p = payload; self.ok = True
    def json(self): return self._p


class FakeSession:
    def __init__(self, payload): self.payload = payload; self.calls = 0
    def get(self, url, params=None, timeout=None, headers=None):
        self.calls += 1
        return FakeResp(self.payload)


def _off(products):
    return {"products": products}


def test_single_confident_candidate_enriches(tmp_path):
    session = FakeSession(_off([
        {"code": "5900820000011", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "1 l"},
    ]))
    e = OffEnricher("PL", str(tmp_path / "off.db"), session=session)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "price": 4.59, "barcode": None}]
    stats = e.enrich(products)
    assert products[0]["barcode"] == "5900820000011"
    assert stats["enriched"] == 1


def test_ambiguous_candidates_do_not_enrich(tmp_path):
    session = FakeSession(_off([
        {"code": "5900820000011", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "1 l"},
        {"code": "5900820000028", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "1 l"},
    ]))
    e = OffEnricher("PL", str(tmp_path / "off.db"), session=session)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "price": 4.59, "barcode": None}]
    stats = e.enrich(products)
    assert products[0]["barcode"] is None
    assert stats["ambiguous"] == 1


def test_quantity_mismatch_rejected(tmp_path):
    session = FakeSession(_off([
        {"code": "5900820000035", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "500 ml"},
    ]))
    e = OffEnricher("PL", str(tmp_path / "off.db"), session=session)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "price": 4.59, "barcode": None}]
    e.enrich(products)
    assert products[0]["barcode"] is None


def test_cache_prevents_second_lookup(tmp_path):
    session = FakeSession(_off([
        {"code": "5900820000011", "product_name": "Mleko Łaciate UHT 3,2%", "brands": "Łaciate", "quantity": "1 l"},
    ]))
    e = OffEnricher("PL", str(tmp_path / "off.db"), session=session)
    products = [{"name": "Mleko Łaciate UHT 3,2% 1L", "brand": "Łaciate", "price": 4.59, "barcode": None}]
    e.enrich(products)
    products[0]["barcode"] = None
    stats = e.enrich(products)
    assert session.calls == 1  # ikinci tur cache'ten
    assert products[0]["barcode"] == "5900820000011"
    assert stats["cache_hits"] == 1
```

- [ ] **Step 2: Run to verify it fails** — `python -m pytest tests/test_off_enrich.py -v` → FAIL (module missing).

- [ ] **Step 3: Implement off_enrich.py**

```python
# Cheep-Scraper/countries/_common/off_enrich.py
"""Open Food Facts EAN zenginleştirme — sıfır-hata kuralı: TEK ve tüm kontrolleri
geçen aday yoksa EAN YAZMA. Brand + miktar + isim örtüşmesi hepsi şart.
SQLite cache: haftalık yeniden koşular OFF'a tekrar sormaz (TTL 30 gün)."""
import json
import logging
import re
import sqlite3
import time
import unicodedata
from typing import Dict, List, Optional

import requests

from scrapers.units import parse_quantity_and_unit

logger = logging.getLogger(__name__)

CACHE_TTL_S = 30 * 86400
REQUEST_GAP_S = 6.0          # OFF arama API'si nezaket sınırı (~10 istek/dk)
MIN_NAME_JACCARD = 0.5
USER_AGENT = "Cheep-PriceCompare/1.0 (bulutruzgarofficial@gmail.com)"


def _fold(s: str) -> str:
    """Küçük harf + diakritik düşür + alfanümerik dışını boşluğa çevir."""
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _tokens(s: str) -> set:
    return set(_fold(s).split())


def _base_amount(text: str) -> Optional[str]:
    """Metindeki miktarı taban birime çevir ('1 l' -> '1000.0ml'); yoksa None."""
    qty, unit = parse_quantity_and_unit(text or "")
    if unit in ("l",):
        return f"{qty * 1000}ml"
    if unit == "cl":
        return f"{qty * 10}ml"
    if unit == "ml":
        return f"{qty}ml"
    if unit == "kg":
        return f"{qty * 1000}g"
    if unit == "g":
        return f"{qty}g"
    if (qty, unit) == (1.0, "adet"):
        return None  # parse edilemedi — miktar kontrolü yapılamaz
    return f"{qty}{unit}"


class OffEnricher:
    def __init__(self, country_code: str, cache_path: str, session=None):
        self.cc = country_code.lower()
        self.session = session or requests.Session()
        self._own_session = session is None
        self.db = sqlite3.connect(cache_path)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS off_cache (k TEXT PRIMARY KEY, ean TEXT, ts REAL)"
        )
        self._last_call = 0.0

    def _cache_get(self, key: str):
        row = self.db.execute(
            "SELECT ean, ts FROM off_cache WHERE k=?", (key,)
        ).fetchone()
        if not row or time.time() - row[1] > CACHE_TTL_S:
            return None
        return row  # (ean|'', ts) — '' = kesin MISS cache'i

    def _cache_put(self, key: str, ean: str):
        self.db.execute(
            "INSERT OR REPLACE INTO off_cache VALUES (?,?,?)", (key, ean, time.time())
        )
        self.db.commit()

    def _search(self, terms: str) -> List[Dict]:
        gap = REQUEST_GAP_S - (time.time() - self._last_call)
        if self._own_session and gap > 0:
            time.sleep(gap)
        self._last_call = time.time()
        resp = self.session.get(
            f"https://{self.cc}.openfoodfacts.org/cgi/search.pl",
            params={
                "action": "process", "search_terms": terms, "search_simple": 1,
                "json": 1, "page_size": 10,
                "fields": "code,product_name,brands,quantity",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        if not resp.ok:
            return []
        try:
            return resp.json().get("products", []) or []
        except (ValueError, json.JSONDecodeError):
            return []

    def _candidates(self, name: str, brand: str) -> List[Dict]:
        want_brand = _tokens(brand)
        want_name = _tokens(name)
        want_qty = _base_amount(name)
        if not want_brand or want_qty is None:
            return []  # marka veya miktar yoksa kanıt kurulamaz — hiç arama yapma
        out = []
        for cand in self._search(f"{brand} {name}"):
            code = str(cand.get("code") or "").strip()
            if not re.fullmatch(r"\d{8,14}", code):
                continue
            cand_brand = _tokens(cand.get("brands") or "")
            if not want_brand <= cand_brand and not cand_brand <= want_brand:
                continue
            cand_qty = _base_amount(cand.get("quantity") or "") or _base_amount(cand.get("product_name") or "")
            if cand_qty != want_qty:
                continue
            cand_name = _tokens(cand.get("product_name") or "")
            union = want_name | cand_name
            if not union or len(want_name & cand_name) / len(union) < MIN_NAME_JACCARD:
                continue
            out.append(code)
        return sorted(set(out))

    def enrich(self, products: List[Dict]) -> Dict:
        stats = {"looked_up": 0, "cache_hits": 0, "enriched": 0, "ambiguous": 0, "misses": 0}
        for p in products:
            if p.get("barcode"):
                continue
            name, brand = (p.get("name") or "").strip(), (p.get("brand") or "").strip()
            if not name or not brand:
                continue
            key = f"{_fold(brand)}|{_fold(name)}"
            cached = self._cache_get(key)
            if cached is not None:
                stats["cache_hits"] += 1
                if cached[0]:
                    p["barcode"] = cached[0]
                    stats["enriched"] += 1
                continue
            stats["looked_up"] += 1
            codes = self._candidates(name, brand)
            if len(codes) == 1:
                p["barcode"] = codes[0]
                self._cache_put(key, codes[0])
                stats["enriched"] += 1
            elif len(codes) > 1:
                self._cache_put(key, "")
                stats["ambiguous"] += 1
            else:
                self._cache_put(key, "")
                stats["misses"] += 1
        logger.info("OFF enrichment: %s", stats)
        return stats
```

Note for the executor: the test's second `enrich()` call counts a cache hit that ALSO re-applies the cached EAN — that's the `if cached[0]: p["barcode"] = cached[0]; stats["enriched"] += 1` branch; keep it.

- [ ] **Step 4: Wire into pipeline.py**

In `run_country_pipeline`, after loading `products` from the output file and before `importer.import_products(...)`:

```python
        if config.get("off_enrich"):
            from countries._common.off_enrich import OffEnricher
            enricher = OffEnricher(
                country_code, str(country_dir / "off_cache.sqlite")
            )
            enricher.enrich(products)
```

`countries/poland/config.json`: add `"off_enrich": true,` after `"default_unit": "szt",`. Add `off_cache.sqlite` to `Cheep-Scraper/.gitignore` if a gitignore exists there (create the entry, not the file).

- [ ] **Step 5: Run tests** — `python -m pytest tests/test_off_enrich.py -v` → PASS; whole scraper suite `python -m pytest tests -v` → green.

- [ ] **Step 6: Commit**

```bash
git add Cheep-Scraper/countries/_common/off_enrich.py Cheep-Scraper/countries/_common/pipeline.py Cheep-Scraper/countries/poland/config.json Cheep-Scraper/tests/test_off_enrich.py Cheep-Scraper/.gitignore
git commit -m "feat(scraper): Open Food Facts EAN enrichment with strict single-candidate rule"
```

---

### Task 8: Match-review + merge-audit CLI (backend)

The human gate: review pending `MatchProposal`s and audit every multi-store merge with per-chain `raw_name`s.

**Files:**
- Create: `cheep-backend-express/src/services/match-review.service.ts`
- Create: `cheep-backend-express/scripts/match-review.ts`
- Create: `cheep-backend-express/scripts/audit-merges.ts`
- Test: `cheep-backend-express/test/match-review.test.ts`

**Interfaces:**
- Consumes: `MatchProposal` (Task 2), `StorePrice.raw_name` (Task 3), `productMatcher.mergeProducts(sourceId, targetId)` (existing, `product-matcher.service.ts:414`).
- Produces: `listPendingProposals(countryCode: string)`, `approveProposal(id: number)` (merges `product_id` INTO `candidate_product_id`, marks approved, rejects sibling proposals of the merged product), `rejectProposal(id: number)`.

- [ ] **Step 1: Write the failing test**

```ts
// cheep-backend-express/test/match-review.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  matchProposal: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  country: { findFirst: vi.fn() },
};
const mergeMock = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/api/products/product-matcher.service.js', () => ({
  productMatcher: { mergeProducts: mergeMock },
}));

const { approveProposal, rejectProposal } = await import('../src/services/match-review.service.js');

describe('match review', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approve merges product into candidate and closes siblings', async () => {
    prismaMock.matchProposal.findUnique.mockResolvedValue({
      id: 1, product_id: 901, candidate_product_id: 900, status: 'pending',
    });
    await approveProposal(1);
    expect(mergeMock).toHaveBeenCalledWith(901, 900);
    expect(prismaMock.matchProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { status: 'approved' } }),
    );
    expect(prismaMock.matchProposal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product_id: 901, status: 'pending', id: { not: 1 } },
        data: { status: 'rejected' },
      }),
    );
  });

  it('approve on non-pending proposal throws', async () => {
    prismaMock.matchProposal.findUnique.mockResolvedValue({ id: 2, status: 'approved' });
    await expect(approveProposal(2)).rejects.toThrow();
    expect(mergeMock).not.toHaveBeenCalled();
  });

  it('reject only flips status', async () => {
    prismaMock.matchProposal.findUnique.mockResolvedValue({ id: 3, status: 'pending' });
    await rejectProposal(3);
    expect(mergeMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run test/match-review.test.ts` → FAIL.

- [ ] **Step 3: Implement match-review.service.ts**

```ts
// cheep-backend-express/src/services/match-review.service.ts
import { prisma } from '../utils/prisma.client.js';
import { productMatcher } from '../api/products/product-matcher.service.js';

export async function listPendingProposals(countryCode: string) {
    const country = await prisma.country.findFirst({ where: { code: countryCode.toUpperCase() } });
    if (!country) throw new Error(`Bilinmeyen ülke: ${countryCode}`);
    return prisma.matchProposal.findMany({
        where: { country_id: country.id, status: 'pending' },
        orderBy: { similarity: 'desc' },
    });
}

export async function approveProposal(id: number) {
    const p = await prisma.matchProposal.findUnique({ where: { id } });
    if (!p || p.status !== 'pending') throw new Error(`Teklif ${id} pending değil`);
    // Yeni ürün (product_id) kanonik adaya (candidate_product_id) katılır.
    await productMatcher.mergeProducts(p.product_id, p.candidate_product_id);
    await prisma.matchProposal.update({ where: { id }, data: { status: 'approved' } });
    // Aynı yeni ürünün diğer bekleyen teklifleri artık geçersiz (ürün silindi).
    await prisma.matchProposal.updateMany({
        where: { product_id: p.product_id, status: 'pending', id: { not: id } },
        data: { status: 'rejected' },
    });
    return p;
}

export async function rejectProposal(id: number) {
    const p = await prisma.matchProposal.findUnique({ where: { id } });
    if (!p || p.status !== 'pending') throw new Error(`Teklif ${id} pending değil`);
    return prisma.matchProposal.update({ where: { id }, data: { status: 'rejected' } });
}
```

- [ ] **Step 4: Implement the two CLIs**

```ts
// cheep-backend-express/scripts/match-review.ts
// Kullanım: npx tsx scripts/match-review.ts list PL
//          npx tsx scripts/match-review.ts approve 12
//          npx tsx scripts/match-review.ts reject 12
import { prisma } from '../src/utils/prisma.client.js';
import { listPendingProposals, approveProposal, rejectProposal } from '../src/services/match-review.service.js';

const [cmd, arg] = process.argv.slice(2);

async function main() {
    if (cmd === 'list') {
        const rows = await listPendingProposals(arg || 'PL');
        for (const r of rows) {
            const [a, b] = await Promise.all([
                prisma.product.findUnique({ where: { id: r.product_id }, include: { store_prices: true } }),
                prisma.product.findUnique({ where: { id: r.candidate_product_id }, include: { store_prices: true } }),
            ]);
            console.log(`#${r.id}  sim=${r.similarity.toFixed(3)}  [${r.evidence}]`);
            console.log(`   YENİ  ${a?.id}: ${a?.name} | ${a?.brand ?? '-'} | mağaza: ${a?.store_prices.map(s => s.store_id).join(',')}`);
            console.log(`   ADAY  ${b?.id}: ${b?.name} | ${b?.brand ?? '-'} | mağaza: ${b?.store_prices.map(s => s.store_id).join(',')}`);
        }
        console.log(`\nToplam bekleyen: ${rows.length}`);
    } else if (cmd === 'approve') {
        await approveProposal(Number(arg));
        console.log(`Teklif ${arg} onaylandı ve birleştirildi.`);
    } else if (cmd === 'reject') {
        await rejectProposal(Number(arg));
        console.log(`Teklif ${arg} reddedildi.`);
    } else {
        console.log('Kullanım: match-review.ts list <CC> | approve <id> | reject <id>');
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
```

```ts
// cheep-backend-express/scripts/audit-merges.ts
// Ülkedeki ÇOK-mağazalı her ürünü, mağaza başına ham (raw_name) adla listeler.
// Sıfır-hata kapısı: bu raporun TAMAMI elle doğrulanmadan Faz 2'ye geçilmez.
// Kullanım: npx tsx scripts/audit-merges.ts PL > audit-pl.md
import { prisma } from '../src/utils/prisma.client.js';

const code = (process.argv[2] || 'PL').toUpperCase();

async function main() {
    const country = await prisma.country.findFirst({ where: { code } });
    if (!country) throw new Error(`Bilinmeyen ülke: ${code}`);
    const products = await prisma.product.findMany({
        where: { country_id: country.id },
        include: { store_prices: { include: { store: true } }, category: true },
        orderBy: { id: 'asc' },
    });
    const merged = products.filter(p => p.store_prices.length >= 2);
    console.log(`# ${code} Birleşme Denetimi — ${new Date().toISOString().slice(0, 10)}`);
    console.log(`Toplam ürün: ${products.length}, çok-mağazalı (birleşmiş): ${merged.length}\n`);
    for (const p of merged) {
        const ean = p.ean_barcode ? ` EAN:${p.ean_barcode}` : ' (EAN yok — fingerprint birleşmesi)';
        console.log(`## #${p.id} ${p.name}${ean}  [kategori: ${p.category?.slug ?? 'YOK'}]`);
        for (const sp of p.store_prices) {
            console.log(`- ${sp.store.name}: "${sp.raw_name ?? '?'}" → ${sp.price} ${sp.unit}`);
        }
        console.log('');
    }
    const uncategorized = products.filter(p => !p.category_id).length;
    console.log(`---\nKategorisiz ürün: ${uncategorized} / ${products.length}`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Run tests** — `npx vitest run test/match-review.test.ts` → PASS; `npm test` green; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add cheep-backend-express/src/services/match-review.service.ts cheep-backend-express/scripts/match-review.ts cheep-backend-express/scripts/audit-merges.ts cheep-backend-express/test/match-review.test.ts
git commit -m "feat(tooling): match-proposal review CLI + multi-store merge audit report"
```

---

### Task 9: Pilot run + zero-error gate (runbook — manual)

All four chains, current scraper coverage, full evidence-gated pipeline, then a 100% manual audit. **Phase-2 work (Task 10) must not start until this audit shows 0 wrong merges and 0 wrong categories.**

**Files:**
- Create: `docs/superpowers/pilots/2026-07-pl-pilot-audit.md` (the audit result)

**Interfaces:**
- Consumes: everything from Tasks 1-8.

- [ ] **Step 1: Start the stack** — from `cheep-backend-express/`: ensure Postgres runs (see `deploy/docker-compose.prod.yml` for the local compose variant or existing `.env`), then `npx prisma migrate dev && npm run db:seed && npm run dev`.

- [ ] **Step 2: Run the PL pipeline** — from `Cheep-Scraper/` (venv active, `INGEST_API_KEY` set to the value in backend `.env`):

```bash
python countries/_common/pipeline.py countries/poland/config.json --api-url http://localhost:3000/api/v1
```

Expected: 4 chains scrape (Carrefour skipped/disabled), OFF enrichment stats logged, `imported=N failed=0` per chain. First OFF run is slow (~6s/lookup) — that is by design.

- [ ] **Step 3: Generate the audit** — from `cheep-backend-express/`:

```bash
npx tsx scripts/audit-merges.ts PL > ../docs/superpowers/pilots/2026-07-pl-pilot-audit.md
npx tsx scripts/match-review.ts list PL
```

- [ ] **Step 4: Manually verify EVERY merged group and category** — for each `##` block in the audit file: are all `raw_name`s the same real-world product (brand, variant, size)? Is the category slug right? Record verdicts inline (`✅` / `❌ + neden`) in the audit file. Work the proposal queue with `approve`/`reject`.

- [ ] **Step 5: Fix and iterate** — wrong merge → tighten the responsible tier (bad OFF hit: raise `MIN_NAME_JACCARD`; bad fingerprint merge: check diacritics/gramaj extraction) and re-run Steps 2-4 after `npm run db:reset && npm run db:seed`. Wrong category → fix `category_map.json`. Repeat until the audit is 100% ✅.

- [ ] **Step 6: Commit the passing audit**

```bash
git add docs/superpowers/pilots/2026-07-pl-pilot-audit.md
git commit -m "docs(poland): pilot merge audit — zero wrong merges gate passed"
```

---

### Task 10: Weekly self-refresh + guardrails (Phase 2 — only after Task 9 gate)

Turkey pattern: scheduled scrape→ingest, stale-price pruning, and a count-collapse guard so a broken scraper can't gut the catalog.

**Files:**
- Modify: `Cheep-Scraper/countries/_common/pipeline.py` (count guard)
- Modify: `cheep-backend-express/src/api/store-prices/store-prices.service.ts` (`pruneStalePrices`)
- Create: `Cheep-Scraper/countries/poland/run-weekly.sh`
- Create: `deploy/cheep-fetcher-pl.service`, `deploy/cheep-fetcher-pl.timer`
- Test: `Cheep-Scraper/tests/test_count_guard.py`, extend `cheep-backend-express/test/` prune coverage

**Interfaces:**
- Produces: `should_import(market: str, new_count: int, prev_counts: Dict[str, int], min_ratio: float = 0.6) -> bool` in `pipeline.py`; pipeline writes/reads `countries/<cc>/output/last_good_counts.json`.
- Produces: `pruneStalePrices(countryId?, ttlDays=21)` now prunes `source IN ('api','scrape')` prices (products deletion still mf-only).

- [ ] **Step 1: Write the failing scraper test**

```python
# Cheep-Scraper/tests/test_count_guard.py
from countries._common.pipeline import should_import


def test_collapse_blocks_import():
    assert should_import("Biedronka", new_count=40, prev_counts={"Biedronka": 100}) is False


def test_normal_fluctuation_passes():
    assert should_import("Biedronka", new_count=85, prev_counts={"Biedronka": 100}) is True


def test_first_run_always_passes():
    assert should_import("Biedronka", new_count=10, prev_counts={}) is True
```

- [ ] **Step 2: Run to verify it fails**, then implement in `pipeline.py`:

```python
def should_import(market: str, new_count: int, prev_counts: Dict, min_ratio: float = 0.6) -> bool:
    """Ürün sayısı önceki başarılı koşuya göre çökmüşse (site yapısı değişti /
    engellendi) import ETME — eski-ama-doğru veri, boşaltılmış katalogdan iyidir."""
    prev = prev_counts.get(market)
    if not prev:
        return True
    return new_count >= prev * min_ratio
```

And in `run_country_pipeline`, around the import loop:

```python
    counts_path = country_dir / "output" / "last_good_counts.json"
    prev_counts = json.loads(counts_path.read_text(encoding="utf-8")) if counts_path.exists() else {}
    ...
    for r in scrape_results:
        ...
        if not should_import(r["market"], len(products), prev_counts):
            logger.error("%s %s: ürün sayısı çöktü (%s, önceki %s) — import atlandı",
                         country_code, r["market"], len(products), prev_counts.get(r["market"]))
            summary["markets"].append({"market": r["market"], "skipped": "count_collapse"})
            continue
        ...  # enrich + import (mevcut akış)
        prev_counts[r["market"]] = len(products)
    counts_path.write_text(json.dumps(prev_counts), encoding="utf-8")
```

Run `python -m pytest tests/test_count_guard.py -v` → PASS.

- [ ] **Step 3: Extend pruneStalePrices for scrape sources**

`store-prices.service.ts:138` becomes:

```ts
    const priceWhere: any = { source: { in: ['api', 'scrape'] }, last_updated_at: { lt: cutoff } };
```

Check `store-prices.routes.ts` for an existing prune route; if none, add one (ingest-key-guarded) mirroring the bulk-upsert route pattern:

```ts
router.post('/prune', requireIngestKey, StorePriceController.pruneStale);
```

with a thin controller passing `req.country?.id`. Add/extend a vitest covering that a `scrape` price older than TTL matches the where-clause builder (mock prisma, assert `deleteMany` filter). Run `npm test` → green.

- [ ] **Step 4: Weekly script + systemd units**

```bash
# Cheep-Scraper/countries/poland/run-weekly.sh
#!/usr/bin/env bash
# Haftalık Polonya scrape + OFF enrichment + ingest + bayat fiyat temizliği.
set -euo pipefail
cd "$(dirname "$0")/../.."          # -> Cheep-Scraper/
export PYTHONIOENCODING=utf-8
if [ -f venv/bin/activate ]; then source venv/bin/activate; fi

API="${CHEEP_API_URL:-http://localhost:3000/api/v1}"
echo "=== PL weekly run $(date -Iseconds) ==="
python countries/_common/pipeline.py countries/poland/config.json --api-url "$API"
# Temizlik: yalnızca koşu BAŞARILIYSA (set -e yukarıda düşürür)
curl -fsS -X POST "$API/store-prices/prune" -H "x-api-key: ${INGEST_API_KEY}" -H "x-country: PL" || echo "prune atlandı"
echo "=== done $(date -Iseconds) ==="
```

```ini
# deploy/cheep-fetcher-pl.service
[Unit]
Description=Cheep Polonya haftalık scrape+ingest (4 zincir, OFF enrichment)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/cheep/Cheep-Scraper
EnvironmentFile=/opt/cheep/deploy/.env
Environment=CHEEP_API_URL=http://localhost:3000/api/v1
ExecStart=/bin/bash countries/poland/run-weekly.sh
Nice=10
IOSchedulingClass=idle
StandardOutput=append:/opt/cheep/Cheep-Scraper/logs/fetcher-pl.log
StandardError=append:/opt/cheep/Cheep-Scraper/logs/fetcher-pl.log
```

```ini
# deploy/cheep-fetcher-pl.timer
[Unit]
Description=Cheep PL haftalık pipeline zamanlayıcısı (Pazar 03:00)

[Timer]
OnCalendar=Sun *-*-* 03:00:00
Persistent=true
RandomizedDelaySec=1800

[Install]
WantedBy=timers.target
```

Also extend `deploy/install-fetcher.sh` to copy+enable the PL unit and timer (mirror however the TR service is installed there).

- [ ] **Step 5: Commit**

```bash
git add Cheep-Scraper/countries/_common/pipeline.py Cheep-Scraper/countries/poland/run-weekly.sh Cheep-Scraper/tests/test_count_guard.py deploy/cheep-fetcher-pl.service deploy/cheep-fetcher-pl.timer deploy/install-fetcher.sh cheep-backend-express/src/api/store-prices cheep-backend-express/test
git commit -m "feat(pipeline): PL weekly auto-refresh with count-collapse guard and scrape pruning"
```

---

### Task 11: OSM branches for the PL chains + Store coordinates

Route optimization needs `StoreBranch` rows. Aliases exist only for Carrefour/Auchan; PL `Store` rows have no lat/lon at all.

**Files:**
- Modify: `cheep-backend-express/src/config/store-brand-aliases.ts` (PL block, lines 22-25)
- Modify: `cheep-backend-express/prisma/seed.ts` (PL store rows, lines 138-142)
- Create: `Cheep-Scraper/countries/poland/osm_branches.py`
- Test: extend `cheep-backend-express/test/overpass-parse.test.ts`

**Interfaces:**
- Consumes: existing `POST /api/v1/store-branches/bulk-upsert` — payload `{branches: [{store_id, external_ref, name, lat, lon, city?, source}]}` (`store-branch.schema.ts`), max 2000/chunk.
- Produces: PL aliases for `overpass.service.ts` `matchChain`; `StoreBranch` rows `external_ref='osm:<type>/<id>'`, `source='osm'`.

- [ ] **Step 1: Failing alias test** — add to `test/overpass-parse.test.ts` a case: an element `{ tags: { shop: 'convenience', brand: 'Żabka', name: 'Żabka Warszawa Złota 44' } }` parsed with `BRAND_ALIASES.PL` must match `store_id: 47`; a `brand: 'Biedronka'` supermarket must match 44; `brand: 'Lidl'` → 45. Follow the existing test file's use of `parseOverpassElements(json, aliases)`. Run → FAIL.

- [ ] **Step 2: Add aliases** — `store-brand-aliases.ts` PL block becomes:

```ts
  PL: [
    { store_id: 40, chain: 'Carrefour', aliases: ['carrefour', 'carrefour express', 'carrefour market'] },
    { store_id: 41, chain: 'Auchan', aliases: ['auchan', 'auchan supermarket', 'auchan hipermarket'] },
    { store_id: 44, chain: 'Biedronka', aliases: ['biedronka'] },
    { store_id: 45, chain: 'Lidl', aliases: ['lidl'] },
    { store_id: 47, chain: 'Żabka', aliases: ['zabka', 'żabka', 'zabka nano', 'żabka nano'] },
  ],
```

Run the test → PASS.

- [ ] **Step 3: Seed coordinates** — in `seed.ts` add `lat`/`lon` to the five PL store `create` blocks (chain-merkez fallback; şube importu bitene kadar rota motoru koordinatsız kalmasın): Carrefour 40 `lat: 52.2297, lon: 21.0122` (Warszawa), Auchan 41 `lat: 50.0647, lon: 19.9450` (Kraków), Biedronka 44 `lat: 52.2297, lon: 21.0122`, Lidl 45 `lat: 52.2297, lon: 21.0122`, Żabka 47 `lat: 52.2297, lon: 21.0122`. (Both `create:` and add to `update:` so existing rows get backfilled: `update: { lat: 52.2297, lon: 21.0122 }`.)

- [ ] **Step 4: PL OSM import script** — create `Cheep-Scraper/countries/poland/osm_branches.py` modeled directly on `countries/turkey/osm_branches.py` (same mirror list, retry/backoff, and chunked POST — read that file and reuse its structure), with:

```python
CHAINS = [
    (44, "Biedronka", r"Biedronka"),
    (45, "Lidl", r"Lidl"),
    (47, "Żabka", r"Żabka|Zabka"),
    (41, "Auchan", r"Auchan"),
    (40, "Carrefour", r"Carrefour"),
]
SHOP = "supermarket|convenience"
```

area clause `area["ISO3166-1"="PL"][admin_level=2]->.pl;` and `x-country: PL` header on the bulk-upsert POSTs; `external_ref=f"osm:{el['type']}/{el['id']}"`, `source="osm"`, chunks of 2000 (schema max). Do NOT import TR's `ingest_branches` — write the POST inline in this file (self-contained country module).

- [ ] **Step 5: Run it once against the local stack**

```bash
INGEST_API_KEY=<backend .env value> CHEEP_API_URL=http://localhost:3000/api/v1 python countries/poland/osm_branches.py
```

Expected: thousands of branches per chain (Żabka is ~10k — the brand-indexed country query is the same shape Turkey uses for A101 ~2900; if a mirror times out the retry/backoff loop handles it). Verify: `npx tsx -e "import {prisma} from './src/utils/prisma.client.js'; console.log(await prisma.storeBranch.groupBy({by:['store_id'], _count:true, where:{country:{code:'PL'}}})); process.exit(0)"` from `cheep-backend-express/`.

- [ ] **Step 6: Commit**

```bash
git add cheep-backend-express/src/config/store-brand-aliases.ts cheep-backend-express/prisma/seed.ts cheep-backend-express/test/overpass-parse.test.ts Cheep-Scraper/countries/poland/osm_branches.py
git commit -m "feat(locations): PL chain aliases, store coords, OSM branch import"
```

---

### Task 12: Assistant replies in the user's language

`buildSystemPrompt` hardcodes Turkish (`assistant.service.ts:49`). Reply language must come from `User.language`.

**Files:**
- Modify: `cheep-backend-express/src/api/assistant/assistant.service.ts`
- Test: `cheep-backend-express/test/assistant-prompt-language.test.ts`

**Interfaces:**
- Produces: `buildSystemPrompt(profile: any, currency = 'TRY', language = 'tr'): string`. `sendMessage` reads `language` from the user row it already fetches (extend the `is_premium` select).

- [ ] **Step 1: Write the failing test**

```ts
// cheep-backend-express/test/assistant-prompt-language.test.ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../src/api/assistant/assistant.service.js';

describe('assistant prompt language', () => {
  it('defaults to Turkish', () => {
    expect(buildSystemPrompt(null)).toContain('Turkish');
  });
  it('Polish user gets Polish directive and currency', () => {
    const p = buildSystemPrompt({ weekly_budget: 200 }, 'PLN', 'pl');
    expect(p).toContain('Polish');
    expect(p).toContain('200 PLN');
  });
  it('unknown language falls back to Turkish', () => {
    expect(buildSystemPrompt(null, 'TRY', 'xx')).toContain('Turkish');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run test/assistant-prompt-language.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Replace `buildSystemPrompt` in `assistant.service.ts`:

```ts
const LANGUAGE_NAMES: Record<string, string> = {
  tr: 'Turkish', en: 'English', de: 'German', pl: 'Polish', sv: 'Swedish',
};

export function buildSystemPrompt(profile: any, currency: string = 'TRY', language: string = 'tr'): string {
  const langName = LANGUAGE_NAMES[language] ?? 'Turkish';
  const lines = [
    `You are Cheep, a smart shopping assistant. ALWAYS reply in ${langName} — every message, regardless of the language the user writes in. Be warm and non-judgmental; frame saving money positively.`,
    'Access the user\'s lists/products/prices via tools. Before modifying a list, ask a short clarifying question if needed (e.g. "it\'s already on your list — add another?").',
    'If the user asks for a generic/brandless product, pass brandIndependent=true to add_items_to_list; if a brand is named, pass false.',
    `Today: ${new Date().toISOString().slice(0, 10)}.`,
  ];
  if (profile) {
    lines.push('User profile (adapt suggestions; NEVER violate hard constraints):');
    if (profile.diet) lines.push(`- Diet: ${profile.diet}`);
    if (profile.avoid?.length) lines.push(`- Avoids: ${profile.avoid.join(', ')}`);
    if (profile.allergies?.length) lines.push(`- Allergies: ${profile.allergies.join(', ')} (never suggest)`);
    if (profile.household_size) lines.push(`- Household: ${profile.household_size}`);
    if (profile.weekly_budget) lines.push(`- Weekly budget: ${profile.weekly_budget} ${currency}`);
  }
  return lines.join('\n');
}
```

In `sendMessage`, change the user fetch (line ~83) to `select: { is_premium: true, language: true }` and the session creation to:

```ts
    systemInstruction: buildSystemPrompt(profile, currency, limitUser?.language ?? 'tr'),
```

- [ ] **Step 4: Run tests** — target PASS; `npm test` green (fix any existing assistant test asserting the old Turkish first line).

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/src/api/assistant cheep-backend-express/test
git commit -m "feat(assistant): reply in the user's language instead of hardcoded Turkish"
```

---

### Task 13: Mobile — TR/PL-only pickers + active location-based country

Geo detection already exists (`Cheep-Mobile/src/utils/geo.ts` `getCountryCode`, used passively in `OnboardingScreen.tsx:220`). Two changes: restrict to TR/PL, and make the onboarding country step ASK for location (consent + OS permission) instead of only using pre-existing consent.

**Files:**
- Modify: `Cheep-Mobile/src/utils/geo.ts`
- Modify: `Cheep-Mobile/src/screens/onboarding/OnboardingScreen.tsx`
- Modify: `Cheep-Mobile/src/screens/profile/ProfileScreen.tsx`

**Interfaces:**
- Produces: `SUPPORTED_COUNTRY_CODES = ['TR', 'PL']`; new `getCountryCodeInteractive(): Promise<string | null>` in `geo.ts` that actively asks consent+permission (used ONLY by onboarding; the silent `getCountryCode` stays for other callers).
- `COUNTRY_CONFIG` keeps all 5 entries (formatting for any legacy stored country) — pickers filter by `SUPPORTED_COUNTRY_CODES`.

- [ ] **Step 1: geo.ts** — change the constant:

```ts
export const SUPPORTED_COUNTRY_CODES = ['TR', 'PL'] as const;
```

Add below `getCountryCode`:

```ts
/**
 * AKTİF ülke tespiti — onboarding ülke adımı için: açık rıza istemini gösterir,
 * sonra OS izni ister. Reddedilirse null → manuel seçici devrede kalır.
 */
export async function getCountryCodeInteractive(): Promise<string | null> {
  try {
    const consented = await ensureLocationConsent();
    if (!consented) return null;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const iso = places[0]?.isoCountryCode?.toUpperCase();
    return iso && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(iso) ? iso : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: OnboardingScreen.tsx** — swap the passive call (line ~220) to the interactive one: import `getCountryCodeInteractive` instead of `getCountryCode` and call it in the same effect (behavior identical afterwards: sets country unless the user already picked manually, `manualCountryPickedRef` guard stays). Filter the picker options (line ~405):

```ts
  const countryOptions = Object.keys(COUNTRY_CONFIG)
    .filter((code) => (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(code))
    .map((code) => ({ ... }));   // mevcut map gövdesi aynı kalır
```

(import `SUPPORTED_COUNTRY_CODES` from `../../utils/geo`).

- [ ] **Step 3: ProfileScreen.tsx** — find where it builds its country options from `COUNTRY_CONFIG` (grep `COUNTRY_CONFIG` in the file) and apply the same `.filter(...)`.

- [ ] **Step 4: Manual smoke check** — from `Cheep-Mobile/`: `npx tsc --noEmit` clean; then `npx expo start` and verify in Expo Go/emulator: onboarding country step shows ONLY Türkiye and Polska; consent prompt appears on that step; denying leaves manual selection working.

- [ ] **Step 5: Commit**

```bash
git add Cheep-Mobile/src/utils/geo.ts Cheep-Mobile/src/screens/onboarding/OnboardingScreen.tsx Cheep-Mobile/src/screens/profile/ProfileScreen.tsx
git commit -m "feat(mobile): TR/PL-only country pickers; onboarding actively geo-detects country"
```

---

### Task 14: End-to-end verification + Play Store release

**Files:**
- Modify: `Cheep-Mobile/verify_multicountry.py` (extend PL coverage)
- Create: `docs/superpowers/pilots/2026-07-pl-release-checklist.md`

- [ ] **Step 1: Extend the e2e script** — read `Cheep-Mobile/verify_multicountry.py` and extend its PL flow to assert: (a) store filter/compare shows exactly Biedronka, Lidl, Żabka, Auchan (and NOT Carrefour), (b) prices render with `zł`, (c) a Polish product from the pilot ingest appears with a category, (d) assistant reply to a Polish message contains no Turkish (spot-check). Follow the script's existing structure for TR/PL cases.

- [ ] **Step 2: Run it** against the local stack with pilot data loaded: `python verify_multicountry.py` from `Cheep-Mobile/` (check the file header for exact invocation/env). Expected: all PL assertions pass.

- [ ] **Step 3: Compare/route smoke test** — with a Warsaw location (52.2297, 21.0122) create a list of 5 pilot products and hit the compare endpoint (see `compare-engine.service.ts` route in `src/api/`); verify each allocation carries a nearest-branch distance (needs Task 11 branches). No `null` coordinates, no TRY symbols.

- [ ] **Step 4: Write the release checklist** at `docs/superpowers/pilots/2026-07-pl-release-checklist.md` — items: Play Console → add Poland to country availability; Polish store listing (title/short/full description — source copy from `Cheep-Mobile/src/i18n/locales/pl.json` tone); screenshots with PL data; closed-testing track first with PL testers; version bump in `Cheep-Mobile/app.json` per the repo's `chore(mobile): bump` convention; droplet deploy of backend + `systemctl enable --now cheep-fetcher-pl.timer`; run `osm_branches.py` once against prod.

- [ ] **Step 5: Commit**

```bash
git add Cheep-Mobile/verify_multicountry.py docs/superpowers/pilots/2026-07-pl-release-checklist.md
git commit -m "test(poland): e2e multicountry coverage for PL launch + release checklist"
```

---

## Execution order

Critical path: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 (gate) → 10 → 14**. Tasks 11, 12, 13 are independent of the data track and can run any time after Task 3 (11 needs nothing from the data track; 12 and 13 are fully independent). Task 14 last.
