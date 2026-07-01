# Phase 1 — Country & Language Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cheep fully country-scoped (users only ever see/optimize their own country's markets) and multi-language (UI language chosen at signup + changeable in Profile, decoupled from country), with prices shown in each country's currency — all testable with seed data before any new scraper data exists.

**Architecture:** The backend schema is already multi-country (`Country{code,name,currency}`, `Store.country_id`, `Product.country_id`, `User.country_id`); `x-country` middleware is globally mounted. We close the country-scoping gaps (route optimizer, single-product queries), resolve currency from `Country.currency` instead of hardcoded `₺`, and persist per-user `country_id`+`language`. On mobile we add i18next + a `LocaleContext` that formats money/dates from the **active country's** currency+locale, extract Turkish UI strings into `tr/en/de/pl/sv` locale files, add language+country steps to onboarding and switchers to Profile, and make store logos country-aware.

**Tech Stack:** Backend — Node ESM, Express, Prisma (Postgres), vitest. Mobile — Expo SDK 54, React Native 0.81, TypeScript, i18next + react-i18next + expo-localization.

## Global Constraints

- **Backend module system is ESM**: all relative imports end in `.js` (e.g. `import { prisma } from '../../utils/prisma.client.js'`), even for `.ts` files. Match this exactly.
- **Backend tests**: vitest, files in `cheep-backend-express/test/*.test.ts`. Run a single file with `npm test -- <name>` (e.g. `npm test -- compare-country`). Existing tests are pure-unit (no live DB); keep new logic unit-testable by extracting pure helpers rather than writing DB-integration tests.
- **Mobile body font quirk**: only headings/prices use `SpaceGrotesk`; body stays `'System'` to preserve inline `fontWeight`. Do not change font wiring.
- **Language ≠ Country** (spec §3.1): UI language and shopping country are independent. Language drives i18n strings only; country drives markets/prices/currency. Never couple them.
- **Currency is NOT converted** (spec §11): each country shows prices in its own currency; no cross-currency math.
- **Store ID ranges** (spec §6.4): TR 1–9, CH 10–19, SE 20–29, DE 30–39, PL 40–49. Seed rows must use these.
- **Initial locales**: `tr, en, de, pl, sv`. `tr.json` is the source of truth; others are translated from it. Switzerland UI starts on `de`.
- **Do not add heavy deps** beyond `i18next`, `react-i18next`, `expo-localization`.
- **Country codes are ISO-3166 alpha-2 uppercase** (`TR`,`CH`,`SE`,`DE`,`PL`). Currency ISO-4217 (`TRY`,`CHF`,`SEK`,`EUR`,`PLN`).

---

## File Structure

**Backend (`cheep-backend-express/`)**
- `prisma/schema.prisma` — add `User.language`.
- `prisma/seed.ts` — add CH/SE/DE countries + stores + a few per-country sample products/prices.
- `src/middleware/country.middleware.ts` — attach `currency` to `req.country`.
- `src/types/express.d.ts` (or wherever `req.country` is typed) — add `currency`.
- `src/services/compare-engine.service.ts` — country-filter list-item store_prices (new pure helper `filterListItemsByCountry`).
- `src/api/lists/lists-compare.controller.ts` — pass `req.country.id`.
- `src/api/products/products.service.ts` — add `countryId` scoping to `getProductById`/`getProductByBarcode`/`getProductPrices`/`getProductPriceHistory`/`compareProductPrices`.
- `src/api/products/products.controller.ts` — pass `req.country?.id` to the above.
- `src/api/users/users.service.ts` + `users.controller.ts` + `users.routes.ts` — persist `country_id`+`language` via `PUT /users/me`.
- `src/api/assistant/assistant.service.ts`, `assistant.tools.ts`, `src/services/llm-product-matcher.service.ts` — currency from `Country.currency`, not `TL`/`₺`.
- `test/compare-country.test.ts`, `test/product-country-scope.test.ts`, `test/user-preferences.test.ts` — new vitest files.

**Mobile (`Cheep-Mobile/`)**
- `src/i18n/index.ts` — i18next init.
- `src/i18n/locales/{tr,en,de,pl,sv}.json` — translation resources.
- `src/context/LocaleContext.tsx` — active-country currency/locale + `formatMoney`/`formatNumber`/`formatDate`; `COUNTRY_CONFIG`.
- `src/utils/storage.ts` — add `USER_LANGUAGE` key + `languageStorage`.
- `src/utils/geo.ts` — add `SUPPORTED_COUNTRY_CODES` guard (unsupported geo → default).
- `src/utils/storeLogo.ts` — `getStoreLogoAsset(country, storeName)` + per-country maps.
- `assets/images/{CH,SE,DE,PL}Companies/` — new logo folders (placeholders OK).
- `src/screens/onboarding/OnboardingScreen.tsx` (+ config) — language + country steps.
- `src/screens/profile/ProfileScreen.tsx` — language + country switchers.
- `App.tsx` — wrap `I18nextProvider` + `LocaleProvider`; init language from storage/device.
- 35+ component/screen files — swap hardcoded `₺`/`toLocaleString('tr-TR')` for `formatMoney`; swap Turkish literals for `t()`.

---

## Task 1: Add `language` to User (backend schema + migration)

**Files:**
- Modify: `cheep-backend-express/prisma/schema.prisma` (User model, after `country_id`)

**Interfaces:**
- Produces: `User.language: String?` (nullable ISO-639-1 lowercase, e.g. `"tr"`). Consumed by Task 5.

- [ ] **Step 1: Add the column**

In `schema.prisma`, User model, add after the `country_id` line (schema.prisma:22):

```prisma
  language      String? // Tercih edilen arayüz dili (ISO-639-1: "tr","en","de","pl","sv") — ülkeden bağımsız
```

- [ ] **Step 2: Create the migration**

Run: `cd cheep-backend-express && npm run db:migrate:dev`
Expected: a new migration under `prisma/migrations/*_auto_migration/` adding `language` to `users`; `prisma generate` runs automatically. If DB is unreachable, run `npx prisma migrate dev --name add_user_language --create-only` and note it for deploy.

- [ ] **Step 3: Verify the client type**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). `prisma.user.update({ data: { language: 'tr' } })` now type-checks (verified in Task 5).

- [ ] **Step 4: Commit**

```bash
git add cheep-backend-express/prisma/schema.prisma cheep-backend-express/prisma/migrations
git commit -m "feat(backend): add User.language preference column"
```

---

## Task 2: Attach currency to `req.country`

**Files:**
- Modify: `cheep-backend-express/src/utils/country.ts`
- Modify: `cheep-backend-express/src/middleware/country.middleware.ts`
- Modify: the `Request.country` type declaration (search: `grep -rn "country?:" src/**/*.d.ts src/types` — likely `src/types/express.d.ts`)
- Test: `cheep-backend-express/test/country-resolve.test.ts`

**Interfaces:**
- Produces: `getCountryByCode(code?): Promise<{ id: number; code: string; currency: string }>`; `req.country = { id, code, currency }`. Consumed by Tasks 3, 4, 8.

- [ ] **Step 1: Write the failing test**

Create `cheep-backend-express/test/country-resolve.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: { country: { findUnique: (...a: any[]) => findUnique(...a) } },
}));

import { getCountryByCode, __clearCountryCache } from '../src/utils/country.js';

beforeEach(() => { findUnique.mockReset(); __clearCountryCache(); });

describe('getCountryByCode', () => {
  it('returns id+code+currency for a known code', async () => {
    findUnique.mockResolvedValueOnce({ id: 3, code: 'DE', currency: 'EUR' });
    const c = await getCountryByCode('de');
    expect(c).toEqual({ id: 3, code: 'DE', currency: 'EUR' });
  });

  it('throws on unknown code', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(getCountryByCode('ZZ')).rejects.toThrow(/Bilinmeyen ülke/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- country-resolve`
Expected: FAIL — `getCountryByCode is not a function`.

- [ ] **Step 3: Implement**

In `src/utils/country.ts`, replace the cache/`getCountryIdByCode` block with a richer cache and keep `getCountryIdByCode` as a thin wrapper (back-compat):

```ts
export interface ResolvedCountry { id: number; code: string; currency: string; }

const cache = new Map<string, ResolvedCountry>();

export const DEFAULT_COUNTRY_CODE = (process.env.DEFAULT_COUNTRY_CODE || 'TR').toUpperCase();

/** Test yardımcı — cache'i temizler. */
export function __clearCountryCache() { cache.clear(); }

export async function getCountryByCode(code?: string | null): Promise<ResolvedCountry> {
    const normalized = (code || DEFAULT_COUNTRY_CODE).toUpperCase();
    const cached = cache.get(normalized);
    if (cached !== undefined) return cached;

    const country = await prisma.country.findUnique({ where: { code: normalized } });
    if (!country) {
        throw new Error(`Bilinmeyen ülke kodu: ${normalized} (önce countries tablosuna ekleyin)`);
    }
    const resolved: ResolvedCountry = { id: country.id, code: country.code, currency: country.currency };
    cache.set(normalized, resolved);
    return resolved;
}

export async function getCountryIdByCode(code?: string | null): Promise<number> {
    return (await getCountryByCode(code)).id;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- country-resolve`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire middleware + type**

In `src/middleware/country.middleware.ts`, change the resolver to use `getCountryByCode` and attach currency:

```ts
const c = await getCountryByCode(headerCode || DEFAULT_COUNTRY_CODE);
req.country = { id: c.id, code: c.code, currency: c.currency };
```

In the `Request.country` type declaration, change it to:

```ts
country?: { id: number; code: string; currency: string };
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cheep-backend-express/src cheep-backend-express/test/country-resolve.test.ts
git commit -m "feat(backend): resolve currency into req.country"
```

---

## Task 3: Country-scope the route/basket optimizer (CRITICAL)

**Files:**
- Modify: `cheep-backend-express/src/services/compare-engine.service.ts`
- Modify: `cheep-backend-express/src/api/lists/lists-compare.controller.ts`
- Test: `cheep-backend-express/test/compare-country.test.ts`

**Interfaces:**
- Consumes: `req.country.id` (Task 2).
- Produces: `compareShoppingList(listId, userId, options)` where `options.countryId?: number` restricts every store considered to that country. New exported pure helper `filterStorePricesByCountry(listItems, countryId)`.

- [ ] **Step 1: Write the failing test**

Create `cheep-backend-express/test/compare-country.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterStorePricesByCountry } from '../src/services/compare-engine.service.js';

const listItems = [{
  id: 1, product_id: 10, quantity: 1, unit: 'adet', brand_independent: false,
  product: {
    id: 10, name: 'Süt', brand: null, image_url: null, category_id: null, muadil_grup_id: null,
    store_prices: [
      { id: 1, store_id: 1, price: 40, unit: 'adet', store: { id: 1, name: 'Migros', country_id: 1, lat: null, lon: null } },
      { id: 2, store_id: 30, price: 2, unit: 'adet', store: { id: 30, name: 'REWE', country_id: 3, lat: null, lon: null } },
    ],
  },
}];

describe('filterStorePricesByCountry', () => {
  it('keeps only prices whose store.country_id matches', () => {
    const out = filterStorePricesByCountry(listItems as any, 1);
    expect(out[0].product.store_prices).toHaveLength(1);
    expect(out[0].product.store_prices[0].store.name).toBe('Migros');
  });

  it('is a no-op when countryId is undefined', () => {
    const out = filterStorePricesByCountry(listItems as any, undefined);
    expect(out[0].product.store_prices).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- compare-country`
Expected: FAIL — `filterStorePricesByCountry is not exported`.

- [ ] **Step 3: Implement the helper + include country_id in the query**

In `compare-engine.service.ts`:

(a) Extend the `ProductInList` store `store` shape to include `country_id`:

```ts
        store: {
            id: number;
            name: string;
            country_id: number;
            lat: number | null;
            lon: number | null;
        };
```

(b) Add the exported helper near the top (after imports):

```ts
/**
 * Liste öğelerindeki store_prices'ı yalnızca verilen ülkedeki marketlere indirger.
 * countryId verilmezse dokunmaz (geriye dönük uyum).
 */
export function filterStorePricesByCountry<T extends { product: { store_prices: Array<{ store: { country_id: number } }> } }>(
    listItems: T[],
    countryId: number | undefined
): T[] {
    if (!countryId) return listItems;
    for (const item of listItems) {
        item.product.store_prices = item.product.store_prices.filter(
            sp => sp.store.country_id === countryId
        );
    }
    return listItems;
}
```

(c) Add `countryId?: number` to `CompareOptions`:

```ts
    countryId?: number;              // Ülke scoping — sadece bu ülkedeki marketler
```

(d) In `compareShoppingList`, the list query already includes `store: true` which carries `country_id`. Right after `const listItems = list.list_items as unknown as ProductInList[];` apply the filter:

```ts
    filterStorePricesByCountry(listItems, options.countryId);
```

(e) Also scope the muadil-group sibling query (line ~164) so cross-country siblings don't leak. Change it to:

```ts
        const siblings = await prisma.product.findMany({
            where: {
                muadil_grup_id: { in: muadilIds },
                ...(options.countryId ? { country_id: options.countryId } : {}),
            },
            include: { store_prices: { include: { store: true } } },
        });
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- compare-country`
Expected: PASS (2 tests). Also run `npm test -- brand-independent-pricing` to confirm no regression.

- [ ] **Step 5: Pass countryId from the controller**

In `lists-compare.controller.ts`, add `countryId: req.country?.id` to the options object passed into `CompareEngine.compareShoppingList` (alongside `maxStores`, `userLocation`, etc.).

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cheep-backend-express/src cheep-backend-express/test/compare-country.test.ts
git commit -m "feat(backend): country-scope route optimizer (no cross-country store mixing)"
```

---

## Task 4: Country-scope single-product queries

**Files:**
- Modify: `cheep-backend-express/src/api/products/products.service.ts`
- Modify: `cheep-backend-express/src/api/products/products.controller.ts`
- Test: `cheep-backend-express/test/product-country-scope.test.ts`

**Interfaces:**
- Produces: `getProductById(id, countryId?)`, `getProductByBarcode(barcode, countryId?)`, `getProductPrices(id, countryId?)`, `getProductPriceHistory(id, days?, countryId?)`, `compareProductPrices(id, countryId?)` — all throw `notFound` if the product's `country_id` ≠ `countryId` (when provided).

- [ ] **Step 1: Write the failing test**

Create `cheep-backend-express/test/product-country-scope.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: { product: { findUnique: (...a: any[]) => findUnique(...a) } },
}));
vi.mock('../src/utils/country.js', () => ({ getCountryIdByCode: vi.fn() }));

import { getProductById } from '../src/api/products/products.service.js';

beforeEach(() => findUnique.mockReset());

describe('getProductById country scoping', () => {
  it('returns the product when country matches', async () => {
    findUnique.mockResolvedValueOnce({ id: 5, country_id: 3, store_prices: [], category: null });
    const p = await getProductById(5, 3);
    expect(p.id).toBe(5);
  });

  it('throws notFound when country differs', async () => {
    findUnique.mockResolvedValueOnce({ id: 5, country_id: 1, store_prices: [], category: null });
    await expect(getProductById(5, 3)).rejects.toThrow(/bulunamadı/i);
  });

  it('returns the product when countryId is undefined', async () => {
    findUnique.mockResolvedValueOnce({ id: 5, country_id: 1, store_prices: [], category: null });
    const p = await getProductById(5, undefined);
    expect(p.id).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- product-country-scope`
Expected: FAIL — `getProductById` takes 1 arg / country check missing.

- [ ] **Step 3: Implement**

In `products.service.ts`, add a `countryId?: number` param to each of `getProductById`, `getProductByBarcode`, `getProductPrices`, `getProductPriceHistory`, `compareProductPrices`. After each `findUnique`/existence check, add the guard. Example for `getProductById`:

```ts
export const getProductById = async (id: number, countryId?: number) => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: { category: true, store_prices: { include: { store: true }, orderBy: { price: 'asc' } } },
    });
    if (!product || (countryId && product.country_id !== countryId)) {
        throw notFound('Ürün bulunamadı');
    }
    return product;
};
```

For `getProductByBarcode` apply the same `(countryId && product.country_id !== countryId)` guard. For `getProductPrices`/`getProductPriceHistory`/`compareProductPrices`, first fetch/confirm the product's `country_id` (the existing `findUnique` already returns the row for prices/compare; for history add a lightweight `prisma.product.findUnique({ where:{id}, select:{country_id:true} })` guard before the history query) and throw `notFound` on mismatch.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- product-country-scope`
Expected: PASS (3 tests).

- [ ] **Step 5: Pass countryId from controller**

In `products.controller.ts`, for each corresponding handler pass `req.country?.id` as the new argument (e.g. `ProductService.getProductById(id, req.country?.id)`).

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cheep-backend-express/src cheep-backend-express/test/product-country-scope.test.ts
git commit -m "feat(backend): country-scope single-product queries"
```

---

## Task 5: Persist user country + language preference

**Files:**
- Modify: `cheep-backend-express/src/api/users/users.service.ts`
- Modify: `cheep-backend-express/src/api/users/users.controller.ts`
- Test: `cheep-backend-express/test/user-preferences.test.ts`

**Interfaces:**
- Consumes: `getCountryByCode` (Task 2), `User.language` (Task 1).
- Produces: `updateUser(userId, { name?, country_code?, language? })` — resolves `country_code`→`country_id`, validates `language` ∈ supported set, returns updated user incl. `country_id`, `language`, and `country { code, currency }`.

- [ ] **Step 1: Write the failing test**

Create `cheep-backend-express/test/user-preferences.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: { user: { update: (...a: any[]) => update(...a) } },
}));
vi.mock('../src/utils/country.js', () => ({
  getCountryByCode: vi.fn(async (c: string) => ({ id: c === 'DE' ? 3 : 1, code: c, currency: 'EUR' })),
}));

import { updateUser, SUPPORTED_LANGUAGES } from '../src/api/users/users.service.js';

beforeEach(() => update.mockReset());

describe('updateUser preferences', () => {
  it('maps country_code to country_id', async () => {
    update.mockResolvedValueOnce({ id: 1, language: 'tr', country_id: 3 });
    await updateUser(1, { country_code: 'DE' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ country_id: 3 }),
    }));
  });

  it('rejects an unsupported language', async () => {
    await expect(updateUser(1, { language: 'zz' })).rejects.toThrow(/dil/i);
  });

  it('exposes the supported language set', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['tr', 'en', 'de', 'pl', 'sv']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- user-preferences`
Expected: FAIL — `SUPPORTED_LANGUAGES`/new signature missing.

- [ ] **Step 3: Implement**

In `users.service.ts`, replace `updateUser` and add the constant + import:

```ts
import { getCountryByCode } from '../../utils/country.js';
import { notFound, conflict, badRequest } from '../../utils/app-error.js';

export const SUPPORTED_LANGUAGES = ['tr', 'en', 'de', 'pl', 'sv'] as const;

export const updateUser = async (
    userId: number,
    data: { name?: string; country_code?: string; language?: string }
) => {
    const patch: { name?: string; country_id?: number; language?: string } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.language !== undefined) {
        if (!SUPPORTED_LANGUAGES.includes(data.language as any)) {
            throw badRequest(`Desteklenmeyen dil: ${data.language}`);
        }
        patch.language = data.language;
    }
    if (data.country_code !== undefined) {
        patch.country_id = (await getCountryByCode(data.country_code)).id;
    }

    return await prisma.user.update({
        where: { id: userId },
        data: patch,
        select: {
            id: true, email: true, name: true, language: true, country_id: true,
            created_at: true, updated_at: true,
            country: { select: { code: true, currency: true } },
        },
    });
};
```

> If `badRequest` doesn't exist in `app-error.js`, add it mirroring `conflict`/`notFound` (400 status). Verify: `grep -n "export const" src/utils/app-error.js`.

In `users.controller.ts`, `updateProfile`: forward the new fields:

```ts
        const { name, country_code, language } = req.body;
        const updatedUser = await UserService.updateUser(req.user.id, { name, country_code, language });
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- user-preferences`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cheep-backend-express/src cheep-backend-express/test/user-preferences.test.ts
git commit -m "feat(backend): persist user country + language via PUT /users/me"
```

---

## Task 6: Currency from `Country.currency` in assistant + matcher

**Files:**
- Modify: `cheep-backend-express/src/api/assistant/assistant.service.ts`
- Modify: `cheep-backend-express/src/api/assistant/assistant.tools.ts`
- Modify: `cheep-backend-express/src/services/llm-product-matcher.service.ts`

**Interfaces:**
- Consumes: `req.country.currency` (Task 2), threaded to these services.

- [ ] **Step 1: Locate the hardcoded currency**

Run: `grep -rน "TL\|₺" src/api/assistant src/services/llm-product-matcher.service.ts` (use `grep -rn "TL" ...` then `grep -rn "₺" ...`).
Expected: the lines noted in the spec (weekly budget line, tool `budget` description, matcher price line).

- [ ] **Step 2: Thread currency + replace**

Where the assistant/matcher build prompts, accept a `currency: string` (defaulting to `'TRY'` for back-compat) and substitute it for the literal `TL`/`₺`. Example (assistant.service.ts budget line):

```ts
if (profile.weekly_budget) lines.push(`- Haftalık bütçe: ${profile.weekly_budget} ${currency}`);
```

Matcher price line — pass `currency` in and use it instead of `₺`:

```ts
.map((p, i) => `${i + 1}. "${p.name}"${p.brand ? ` - Marka: ${p.brand}` : ''} - Fiyat: ${currency} ${p.price}`)
```

Thread `req.country?.currency ?? 'TRY'` from the assistant controller into the service call. For the tool description string, make it generic: `'Opsiyonel bütçe limiti (kullanıcının para biriminde)'`.

- [ ] **Step 3: Verify build + existing assistant tests**

Run: `npx tsc --noEmit && npm test -- assistant`
Expected: PASS (assistant-tools, assistant-limit unaffected or updated).

- [ ] **Step 4: Commit**

```bash
git add cheep-backend-express/src
git commit -m "feat(backend): currency from Country model in assistant + matcher"
```

---

## Task 7: Seed CH/SE/DE countries, stores, and sample data

**Files:**
- Modify: `cheep-backend-express/prisma/seed.ts`

**Interfaces:**
- Produces: countries `CH(CHF)`, `SE(SEK)`, `DE(EUR)` (+ existing TR, PL); stores in the ID ranges (spec §6.4); at least 2 products with 2-store prices per new country so per-country UI is testable.

- [ ] **Step 1: Add countries**

After the PL upsert (seed.ts:35), add:

```ts
    const ch = await prisma.country.upsert({
        where: { code: 'CH' }, update: {},
        create: { code: 'CH', name: 'Schweiz', currency: 'CHF' },
    });
    const se = await prisma.country.upsert({
        where: { code: 'SE' }, update: {},
        create: { code: 'SE', name: 'Sverige', currency: 'SEK' },
    });
    const de = await prisma.country.upsert({
        where: { code: 'DE' }, update: {},
        create: { code: 'DE', name: 'Deutschland', currency: 'EUR' },
    });
    const pl = await prisma.country.upsert({
        where: { code: 'PL' }, update: {},
        create: { code: 'PL', name: 'Polska', currency: 'PLN' },
    });
```

(Replace the existing bare PL upsert so `pl` is captured in a variable.)

- [ ] **Step 2: Add anchor stores in the ID ranges**

After the TR stores block (seed.ts:93), add representative anchor stores:

```ts
    // CH 10–19
    await prisma.store.upsert({ where: { id: 10 }, update: {}, create: { id: 10, name: 'Migros', logo_url: null, address: 'Zürich', country_id: ch.id } });
    const coopCh = await prisma.store.upsert({ where: { id: 11 }, update: {}, create: { id: 11, name: 'Coop', logo_url: null, address: 'Bern', country_id: ch.id } });
    const migrosCh = await prisma.store.findUnique({ where: { id: 10 } });
    // SE 20–29
    const ica = await prisma.store.upsert({ where: { id: 20 }, update: {}, create: { id: 20, name: 'ICA', logo_url: null, address: 'Stockholm', country_id: se.id } });
    const willys = await prisma.store.upsert({ where: { id: 21 }, update: {}, create: { id: 21, name: 'Willys', logo_url: null, address: 'Göteborg', country_id: se.id } });
    // DE 30–39
    const rewe = await prisma.store.upsert({ where: { id: 30 }, update: {}, create: { id: 30, name: 'REWE', logo_url: null, address: 'Köln', country_id: de.id } });
    const kaufland = await prisma.store.upsert({ where: { id: 31 }, update: {}, create: { id: 31, name: 'Kaufland', logo_url: null, address: 'Berlin', country_id: de.id } });
    // PL 40–49
    const carrefourPl = await prisma.store.upsert({ where: { id: 40 }, update: {}, create: { id: 40, name: 'Carrefour', logo_url: null, address: 'Warszawa', country_id: pl.id } });
    const auchan = await prisma.store.upsert({ where: { id: 41 }, update: {}, create: { id: 41, name: 'Auchan', logo_url: null, address: 'Kraków', country_id: pl.id } });
```

- [ ] **Step 3: Add 2 products + prices per new country**

After the TR prices block (seed.ts:324), add (uses the same category ids already resolved, e.g. `sutId`, `icecekId`):

```ts
    const deMilch = await prisma.product.upsert({
        where: { ean_barcode: '4000000000001' }, update: { name: 'Ja! Milch 1L', country_id: de.id, category_id: sutId },
        create: { name: 'Ja! Milch 1L', brand: 'Ja!', ean_barcode: '4000000000001', country_id: de.id, category_id: sutId },
    });
    const deCola = await prisma.product.upsert({
        where: { ean_barcode: '5449000000012' }, update: { name: 'Coca-Cola 1L', country_id: de.id, category_id: icecekId },
        create: { name: 'Coca-Cola 1L', brand: 'Coca-Cola', ean_barcode: '5449000000012', country_id: de.id, category_id: icecekId },
    });
    const plMleko = await prisma.product.upsert({
        where: { ean_barcode: '5900000000001' }, update: { name: 'Łaciate Mleko 1L', country_id: pl.id, category_id: sutId },
        create: { name: 'Łaciate Mleko 1L', brand: 'Łaciate', ean_barcode: '5900000000001', country_id: pl.id, category_id: sutId },
    });
    await prisma.storePrice.createMany({ skipDuplicates: true, data: [
        { store_id: rewe.id, product_id: deMilch.id, price: 1.09, unit: 'adet', source: 'seed' },
        { store_id: kaufland.id, product_id: deMilch.id, price: 0.99, unit: 'adet', source: 'seed' },
        { store_id: rewe.id, product_id: deCola.id, price: 1.49, unit: 'adet', source: 'seed' },
        { store_id: kaufland.id, product_id: deCola.id, price: 1.39, unit: 'adet', source: 'seed' },
        { store_id: carrefourPl.id, product_id: plMleko.id, price: 3.49, unit: 'adet', source: 'seed' },
        { store_id: auchan.id, product_id: plMleko.id, price: 3.29, unit: 'adet', source: 'seed' },
        { store_id: ica.id, product_id: deMilch.id, price: 14.9, unit: 'adet', source: 'seed' }, // demonstrates SE currency; separate SE product optional
    ]};
```

> The last SE line reuses a product only to prove SE scoping/currency; if `ean_barcode` uniqueness or cross-country coupling feels wrong, create a dedicated SE product `7300000000001` instead. Keep each price's store in the matching country.

- [ ] **Step 4: Run the seed**

Run: `cd cheep-backend-express && npm run db:seed`
Expected: completes without error; console shows countries + stores created.

- [ ] **Step 5: Commit**

```bash
git add cheep-backend-express/prisma/seed.ts
git commit -m "feat(backend): seed CH/SE/DE countries, anchor stores, sample products"
```

---

## Task 8: Mobile i18n infrastructure + locale files

**Files:**
- Create: `Cheep-Mobile/src/i18n/index.ts`
- Create: `Cheep-Mobile/src/i18n/locales/{tr,en,de,pl,sv}.json`
- Modify: `Cheep-Mobile/package.json` (deps)

**Interfaces:**
- Produces: default-exported configured `i18n` instance; `SUPPORTED_LANGUAGES` list; keys are added incrementally by later tasks. `tr.json` is source of truth.

- [ ] **Step 1: Install deps**

Run: `cd Cheep-Mobile && npx expo install expo-localization && npm install i18next react-i18next`
Expected: `expo-localization`, `i18next`, `react-i18next` added to `package.json`.

- [ ] **Step 2: Create seed locale files**

Create `src/i18n/locales/tr.json` with an initial key set (extend later):

```json
{
  "common": { "continue": "Devam", "skip": "Şimdilik geç", "finish": "Bitir", "save": "Kaydet", "cancel": "İptal" },
  "onboarding": {
    "language_title": "Uygulama dilini seç",
    "language_subtitle": "Bunu daha sonra Profil'den değiştirebilirsin",
    "country_title": "Nerede alışveriş yapıyorsun?",
    "country_subtitle": "Sana sadece ülkendeki marketleri ve fiyatları gösterelim"
  },
  "profile": { "language": "Uygulama dili", "country": "Ülke / Marketler", "about": "Cheep Hakkında" },
  "countries": { "TR": "Türkiye", "CH": "İsviçre", "SE": "İsveç", "DE": "Almanya", "PL": "Polonya" },
  "languages": { "tr": "Türkçe", "en": "English", "de": "Deutsch", "pl": "Polski", "sv": "Svenska" }
}
```

Create `en.json`, `de.json`, `pl.json`, `sv.json` with the **same key structure**, translated. (Country/language display names stay native in every file, e.g. `"countries": { "DE": "Germany" }` in `en.json`, `"Deutschland"` in `de.json`, etc.)

- [ ] **Step 3: Create the i18n init**

Create `src/i18n/index.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './locales/tr.json';
import en from './locales/en.json';
import de from './locales/de.json';
import pl from './locales/pl.json';
import sv from './locales/sv.json';

export const SUPPORTED_LANGUAGES = ['tr', 'en', 'de', 'pl', 'sv'] as const;
export type AppLanguage = typeof SUPPORTED_LANGUAGES[number];

i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en }, de: { translation: de }, pl: { translation: pl }, sv: { translation: sv } },
  lng: 'tr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: PASS (JSON imports resolve; if not, ensure `resolveJsonModule` is on in `tsconfig.json` — it is by default in Expo).

- [ ] **Step 5: Commit**

```bash
git add Cheep-Mobile/src/i18n Cheep-Mobile/package.json Cheep-Mobile/package-lock.json
git commit -m "feat(mobile): i18next infrastructure + tr/en/de/pl/sv locale files"
```

---

## Task 9: LocaleContext (currency/date formatting) + language storage

**Files:**
- Create: `Cheep-Mobile/src/context/LocaleContext.tsx`
- Modify: `Cheep-Mobile/src/utils/storage.ts` (add `USER_LANGUAGE` + `languageStorage`)

**Interfaces:**
- Consumes: `countryStorage` (existing), i18n (Task 8).
- Produces: `useLocale()` → `{ country, setCountry, formatMoney(n), formatNumber(n), formatDate(d) }`; `COUNTRY_CONFIG: Record<code,{currency,symbol,locale}>`; `languageStorage.{get,set}`.

- [ ] **Step 1: Add language storage**

In `storage.ts`, add to `STORAGE_KEYS`: `USER_LANGUAGE: 'user_language',`. Add exported helper:

```ts
export const languageStorage = {
  async save(lang: string): Promise<void> { await storage.setItem(STORAGE_KEYS.USER_LANGUAGE, lang); },
  async get(): Promise<string | null> { return await storage.getItem(STORAGE_KEYS.USER_LANGUAGE); },
};
```

- [ ] **Step 2: Create COUNTRY_CONFIG + LocaleContext**

Create `src/context/LocaleContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { countryStorage } from '../utils/storage';

export const COUNTRY_CONFIG: Record<string, { currency: string; symbol: string; locale: string }> = {
  TR: { currency: 'TRY', symbol: '₺', locale: 'tr-TR' },
  CH: { currency: 'CHF', symbol: 'CHF', locale: 'de-CH' },
  SE: { currency: 'SEK', symbol: 'kr', locale: 'sv-SE' },
  DE: { currency: 'EUR', symbol: '€', locale: 'de-DE' },
  PL: { currency: 'PLN', symbol: 'zł', locale: 'pl-PL' },
};
const DEFAULT_CODE = 'TR';
const cfg = (code: string) => COUNTRY_CONFIG[code] ?? COUNTRY_CONFIG[DEFAULT_CODE];

interface LocaleValue {
  country: string;
  setCountry: (code: string) => Promise<void>;
  formatMoney: (n: number) => string;
  formatNumber: (n: number) => string;
  formatDate: (d: Date | string) => string;
}
const LocaleContext = createContext<LocaleValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<string>(DEFAULT_CODE);

  useEffect(() => { countryStorage.getCountry().then(c => { if (c && COUNTRY_CONFIG[c]) setCountryState(c); }); }, []);

  const setCountry = async (code: string) => {
    const c = code.toUpperCase();
    setCountryState(COUNTRY_CONFIG[c] ? c : DEFAULT_CODE);
    await countryStorage.saveCountry(c);
  };

  const formatMoney = (n: number) => {
    const { currency, locale } = cfg(country);
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${cfg(country).symbol}${n.toFixed(2)}`;
    }
  };
  const formatNumber = (n: number) => {
    try { return new Intl.NumberFormat(cfg(country).locale).format(n); } catch { return String(n); }
  };
  const formatDate = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    try { return new Intl.DateTimeFormat(cfg(country).locale).format(date); } catch { return date.toISOString().slice(0, 10); }
  };

  return (
    <LocaleContext.Provider value={{ country, setCountry, formatMoney, formatNumber, formatDate }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
```

> Note: React Native's Hermes engine ships `Intl` for number/date in SDK 54. If `Intl.NumberFormat` currency style is unavailable at runtime, the `catch` fallback (`symbol + toFixed`) covers it — acceptable for launch.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add Cheep-Mobile/src/context/LocaleContext.tsx Cheep-Mobile/src/utils/storage.ts
git commit -m "feat(mobile): LocaleContext (currency/date formatting) + language storage"
```

---

## Task 10: Wire providers + init language in App.tsx

**Files:**
- Modify: `Cheep-Mobile/App.tsx`

**Interfaces:**
- Consumes: i18n (Task 8), LocaleProvider (Task 9), languageStorage.

- [ ] **Step 1: Wrap providers and init language**

In `App.tsx`, add imports and initialize language from storage → device → `en` before render. Add:

```tsx
import { I18nextProvider } from 'react-i18next';
import * as Localization from 'expo-localization';
import i18n, { SUPPORTED_LANGUAGES } from './src/i18n';
import { LocaleProvider } from './src/context/LocaleContext';
import { languageStorage } from './src/utils/storage';
```

Inside `App`, add a `langReady` state and an effect:

```tsx
  const [langReady, setLangReady] = React.useState(false);
  useEffect(() => {
    (async () => {
      const saved = await languageStorage.get();
      const device = Localization.getLocales?.()[0]?.languageCode ?? 'en';
      const initial = (SUPPORTED_LANGUAGES as readonly string[]).includes(saved ?? '')
        ? saved!
        : (SUPPORTED_LANGUAGES as readonly string[]).includes(device) ? device : 'en';
      await i18n.changeLanguage(initial);
      setLangReady(true);
    })();
  }, []);

  if (!fontsLoaded || !langReady) return null;
```

Wrap the tree:

```tsx
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background.default} />
        <I18nextProvider i18n={i18n}>
          <LocaleProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </LocaleProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add Cheep-Mobile/App.tsx
git commit -m "feat(mobile): wire i18n + Locale providers, init language from device/storage"
```

---

## Task 11: Country-aware store logos

**Files:**
- Modify: `Cheep-Mobile/src/utils/storeLogo.ts`
- Create: `Cheep-Mobile/assets/images/{CH,SE,DE,PL}Companies/.gitkeep` (real logos added as available)
- Update callers: `NewHomeScreen.tsx`, `ProductDetailScreen.tsx`, any `getStoreLogoAsset(` caller (grep).

**Interfaces:**
- Produces: `getStoreLogoAsset(country: string | null | undefined, storeName): any` and `getStoreLogoSource(country, storeName)`. No cross-country fallback.

- [ ] **Step 1: Rewrite with per-country maps**

Replace `storeLogo.ts` body:

```ts
const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

const LOGOS: Record<string, Record<string, any>> = {
  TR: {
    migros: require('../../assets/images/TurkiyeCompanies/M-Migros.png'),
    carrefour: require('../../assets/images/TurkiyeCompanies/carrefour.webp'),
    carrefoursa: require('../../assets/images/TurkiyeCompanies/carrefour.webp'),
  },
  CH: {}, SE: {}, DE: {}, PL: {}, // add requires as logo assets land
};

export function getStoreLogoAsset(country: string | null | undefined, storeName: string | null | undefined): any {
  if (!storeName) return null;
  const map = LOGOS[(country || '').toUpperCase()] ?? {};
  const n = normalize(storeName);
  if (map[n]) return map[n];
  for (const [key, asset] of Object.entries(map)) {
    if (n.includes(key) || key.includes(n)) return asset;
  }
  return null;
}

export function getStoreLogoSource(country: string | null | undefined, storeName: string | null | undefined): { source: any } | null {
  const asset = getStoreLogoAsset(country, storeName);
  return asset ? { source: asset } : null;
}
```

- [ ] **Step 2: Update callers to pass country**

Run: `grep -rn "getStoreLogoAsset(\|getStoreLogoSource(" src`. In each caller, read the active country from `useLocale().country` and pass it first, e.g. `getStoreLogoAsset(country, store.name)`. (Store objects also carry the country via the API, but the active-country from `useLocale` is authoritative for the session.)

- [ ] **Step 3: Create placeholder folders**

Create empty `.gitkeep` in each of `assets/images/{CH,SE,DE,PL}Companies/`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: PASS. Missing logos render the existing initials/badge fallback.

- [ ] **Step 5: Commit**

```bash
git add Cheep-Mobile/src/utils/storeLogo.ts Cheep-Mobile/assets/images
git commit -m "feat(mobile): country-aware store logo registry"
```

---

## Task 12: Onboarding — language + country steps

**Files:**
- Modify: `Cheep-Mobile/src/screens/onboarding/OnboardingScreen.tsx`
- Modify: `Cheep-Mobile/src/context/AuthContext.tsx` (if profile update payload lives there) or `profileService`

**Interfaces:**
- Consumes: `useLocale().setCountry`, `i18n.changeLanguage`, `languageStorage`, `countryStorage`, `SUPPORTED_LANGUAGES`, `COUNTRY_CONFIG`.
- Produces: on finish, persists language (storage + `i18n`) and country (storage + `LocaleContext`) and sends `{ language, country_code }` to `PUT /users/me`.

- [ ] **Step 1: Add a language step (first) and a country step**

Prepend two steps before the existing questions. Language options come from `SUPPORTED_LANGUAGES` with display names via `t('languages.<code>')`; country options from `Object.keys(COUNTRY_CONFIG)` with `t('countries.<code>')`. Default-select language = current `i18n.language`; country = geo-detected (`getCountryCode()` from `geo.ts`, falling back to `TR`).

Selecting a language immediately calls `i18n.changeLanguage(lang)` + `languageStorage.save(lang)` so the rest of onboarding renders in it. Selecting a country calls `useLocale().setCountry(code)`.

- [ ] **Step 2: Send to backend on finish**

In the `finish()` payload, also call the user endpoint with `{ language, country_code }` (via `userService.updateProfile` or a new `userService.updatePreferences`). Keep existing profile fields intact.

- [ ] **Step 3: Replace the onboarding currency symbol**

The budget input's hardcoded `₺` / `/hafta` become `useLocale().formatMoney` context (show the active symbol) and `t('onboarding.per_week')`.

- [ ] **Step 4: Verify (web harness)**

Run the app on web (`npm run web`) and confirm the first two onboarding steps show language + country and that picking `Deutsch`/`Almanya` switches copy + currency symbol. (Formal Playwright check in Task 15.)

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Cheep-Mobile/src/screens/onboarding Cheep-Mobile/src/context Cheep-Mobile/src/services
git commit -m "feat(mobile): language + country selection in onboarding"
```

---

## Task 13: Profile — language + country switchers

**Files:**
- Modify: `Cheep-Mobile/src/screens/profile/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `useLocale()`, `i18n`, `languageStorage`, `userService.updateProfile`.

- [ ] **Step 1: Add two rows under Profile**

Add a "Uygulama dili" (`t('profile.language')`) row opening a picker of `SUPPORTED_LANGUAGES`; on select → `i18n.changeLanguage` + `languageStorage.save` + `PUT /users/me {language}`. Add a "Ülke / Marketler" (`t('profile.country')`) row opening a picker of `COUNTRY_CONFIG` keys; on select → `useLocale().setCountry` + `PUT /users/me {country_code}` and trigger a data refresh (navigate home / invalidate).

- [ ] **Step 2: Verify live re-render**

On web, change language → UI strings update without reload; change country → currency symbol + market list change.

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add Cheep-Mobile/src/screens/profile/ProfileScreen.tsx
git commit -m "feat(mobile): language + country switchers in Profile"
```

---

## Task 14: Currency + string sweep across UI

**Files:**
- Modify (currency): every file from the spec audit — `src/components/product/ProductCard.tsx`, `product/PriceTrendCard.tsx`, `product/ProductGridCard.tsx`, `home/SmartDealCard.tsx`, `home/ActiveListCard.tsx`, `home/FeaturedDealCard.tsx`, `list/ListCard.tsx`, `list/SelectListModal.tsx`, `screens/home/NewHomeScreen.tsx`, `screens/onboarding/OnboardingScreen.tsx`, `screens/deals/DealsScreen.tsx`, `screens/lists/CompareResultsScreen.tsx`, `screens/intro/IntroTourScreen.tsx`.
- Modify (strings): the same screens + `ProfileScreen`, `DealsScreen`, `PriceTrendCard`, `ListCard`, onboarding.

**Interfaces:**
- Consumes: `useLocale().formatMoney/formatDate`, `useTranslation().t`.

- [ ] **Step 1: Find every hardcoded currency**

Run: `grep -rn "₺\|toLocaleString('tr-TR')\|toLocaleDateString('tr-TR')" src`
Expected: the ~35 sites listed in the spec.

- [ ] **Step 2: Replace currency sites**

For each match, replace the manual format with `formatMoney(value)` from `useLocale()`. Example — `ProductCard.tsx:63`:

```tsx
// before: <Text style={styles.price}>₺{lowestPrice.toFixed(2)}</Text>
const { formatMoney } = useLocale();
// ...
<Text style={styles.price}>{formatMoney(lowestPrice)}</Text>
```

For `NewHomeScreen.tsx:35`, delete the local `tl` helper and use `formatMoney`. For pure helpers that can't call hooks (e.g. `PriceTrendCard`'s `formatValue`), pass a formatter prop down from the component that owns the hook. Replace `toLocaleDateString('tr-TR')` with `formatDate`.

- [ ] **Step 3: Extract visible Turkish strings to `t()`**

For each screen touched, move user-visible Turkish literals into `tr.json` under a screen namespace (e.g. `deals.*`, `product.*`, `list.*`, `home.*`) and reference them via `const { t } = useTranslation(); ... t('deals.empty_title')`. Mirror every new key into `en/de/pl/sv.json` (translated). Keep `IntroTourScreen` example prices realistic per active country or make them generic (they're illustrative).

> This is a mechanical sweep. Do it screen-by-screen, committing per screen or per small group, running `npx tsc --noEmit` after each. Do NOT try to externalize every deep utility string in one commit — prioritize what the user sees on the main flows (Home, Deals, Product, Lists/Compare, Onboarding, Profile, Intro).

- [ ] **Step 4: Verify no hardcoded currency remains on main flows**

Run: `grep -rn "₺" src/screens src/components`
Expected: no matches on the audited files (illustrative intro copy may remain if intentionally generic).

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit (per screen/group)**

```bash
git add Cheep-Mobile/src
git commit -m "refactor(mobile): currency via formatMoney + strings via i18n (main flows)"
```

---

## Task 15: End-to-end per-country verification (Playwright web harness)

**Files:**
- Create: `Cheep-Mobile/verify_multicountry.py` (gitignored screenshot script — add to `.gitignore` like the others)

**Interfaces:**
- Consumes: seeded backend (Task 7), running web app + backend.

- [ ] **Step 1: Start backend + web**

Run backend (`cd cheep-backend-express && npm run dev`) with a seeded DB, and the mobile web app (`cd Cheep-Mobile && npm run web`).

- [ ] **Step 2: Write the verification script**

Create `verify_multicountry.py` that, for country `DE` and language `de`:
- sets `localStorage.intro_seen='1'`, `localStorage.user_country='DE'`, `localStorage.user_language='de'` before load,
- loads the app, screenshots Home,
- asserts a German store name (`REWE` or `Kaufland`) appears and no Turkish-only store (`Migros`/`ŞOK`) appears,
- asserts the euro symbol `€` (or `EUR`) appears in a price and `₺` does not.

Repeat for `PL`/`pl` (expect `Carrefour`/`Auchan`, `zł`, Polish copy).

```python
# skeleton — mirror existing screenshot scripts' Playwright setup
import sys, io
from playwright.sync_api import sync_playwright
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

def check(country, lang, expect_store, forbid_store, expect_cur, forbid_cur):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width":390,"height":760}, locale=f"{lang}-{country}")
        pg = ctx.new_page()
        pg.add_init_script(f"localStorage.setItem('intro_seen','1');localStorage.setItem('user_country','{country}');localStorage.setItem('user_language','{lang}');")
        pg.goto("http://localhost:8081", wait_until="domcontentloaded", timeout=120000)
        pg.wait_for_timeout(12000)
        body = pg.inner_text("body")
        print(country, "store ok:", expect_store in body, "| no TR store:", forbid_store not in body,
              "| cur ok:", expect_cur in body, "| no TR cur:", forbid_cur not in body)
        pg.screenshot(path=f"screenshots/mc-{country}.png")
        ctx.close()

check("DE","de","REWE","ŞOK","€","₺")
check("PL","pl","Carrefour","Migros","zł","₺")
```

- [ ] **Step 3: Run it**

Run: `cd Cheep-Mobile && python verify_multicountry.py`
Expected: both lines report `store ok: True | no TR store: True | cur ok: True | no TR cur: True`. Inspect `screenshots/mc-DE.png`, `mc-PL.png` visually.

- [ ] **Step 4: Fix any failures, then commit the (gitignored) script reference**

Add `verify_multicountry.py` to `Cheep-Mobile/.gitignore` (matching the existing screenshot-script pattern).

```bash
git add Cheep-Mobile/.gitignore
git commit -m "chore(mobile): ignore multi-country verification script"
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** §4 backend scoping → Tasks 2–6; §4.6 seed → Task 7; §5 mobile i18n/currency/onboarding/profile/logos → Tasks 8–14; §3.1 decoupling → Tasks 9/12/13; §8 testing → per-task vitest + Task 15. §6/§7 (scrapers, scheduler) are **Phase 2**, intentionally not in this plan.
- **Placeholder scan:** none — every code step shows code; sweeps (Task 14) give methodology + representative examples + grep-based completion checks, which is appropriate for a repetitive edit.
- **Type consistency:** `getCountryByCode`/`ResolvedCountry`/`req.country.currency` used consistently across Tasks 2/5/6; `filterStorePricesByCountry` and `countryId` option names match between Task 3 def and controller use; `getStoreLogoAsset(country, name)` signature consistent between Task 11 def and caller updates; `formatMoney`/`useLocale` consistent across Tasks 9/12/13/14; `SUPPORTED_LANGUAGES = ['tr','en','de','pl','sv']` identical on backend (Task 5) and mobile (Task 8).
- **Known follow-ups (not blockers):** real logo assets per country arrive with Phase 2 scraper data; full string externalization beyond main flows is iterative (Task 14 scopes to what the user sees first).
