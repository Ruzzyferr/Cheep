# Cheep Full-Stack Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden, clean up, and extend the Cheep platform (Python scraper + Express/Prisma API + Expo/RN mobile) so it is secure, correct, tested, well-configured, and adds high-impact features that differentiate a real price-comparison product.

**Architecture:** The repo is a monorepo with three independent subsystems. This plan is organized into **phases** ordered by value and risk. Phases 1–2 (security + correctness) are mandatory and low-risk; Phase 3 (cleanup) and Phase 4 (config/DX) are quick wins; Phase 5 (tests) builds a safety net; Phase 6 (features) is a prioritized backlog to be confirmed before implementation.

**Tech Stack:** Express 4 + TypeScript (ESM, `.js` import specifiers) + Prisma + PostgreSQL + Joi + JWT/bcryptjs + Winston; Expo SDK 54 / React Native 0.81 + React Navigation + Axios + expo-secure-store; Python 3.12 + Playwright/requests + OpenAI/OpenRouter.

**Verification baseline (run before & after each phase):**
- Backend: `cd cheep-backend-express && pnpm tsc --noEmit` (typecheck) and `pnpm dev` boots clean.
- Mobile: `cd Cheep-Mobile && npx tsc --noEmit` and `npx expo start` bundles.
- Scraper: `cd Cheep-Scraper && python -m py_compile <changed files>`.

---

## Phase 1 — Backend Security (CRITICAL, do first)

**Why:** Multiple write endpoints are unauthenticated and several owner-scoped operations have IDOR (Insecure Direct Object Reference) holes. These are real exploitable issues.

**Files:**
- Modify: `cheep-backend-express/src/api/auth/auth.routes.ts`
- Read: `cheep-backend-express/src/api/auth/auth.schema.ts` (already exists; wire it up)
- Modify: `cheep-backend-express/src/api/products/products.routes.ts`
- Modify: `cheep-backend-express/src/api/store-prices/store-prices.routes.ts`
- Modify: `cheep-backend-express/src/api/lists/lists-compare.controller.ts`
- Modify: `cheep-backend-express/src/config/index.ts`
- Modify: `cheep-backend-express/src/index.ts` (CORS)
- Modify: `cheep-backend-express/src/middleware/rate-limit.middleware.ts`
- Read: `cheep-backend-express/src/middleware/auth.middleware.ts` (confirm exported name, e.g. `authenticate`)

### Task 1.1: Wire auth validation onto register/login

- [ ] **Step 1:** Confirm `auth.schema.ts` exports `registerSchema` and `loginSchema` (Joi). If names differ, use the actual names.
- [ ] **Step 2:** Edit `auth.routes.ts` to import the validation middleware and schemas:

```ts
import { validate } from '../../schema/validation.middleware.js';
import { registerSchema, loginSchema } from './auth.schema.js';
```

- [ ] **Step 3:** Apply them to the routes:

```ts
router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
```

- [ ] **Step 4:** Verify `pnpm tsc --noEmit` passes; manually POST an invalid email to `/api/v1/auth/register` and expect 400.
- [ ] **Step 5:** Commit: `fix(backend): enforce input validation on auth routes`.

### Task 1.2: Protect product write endpoints with admin/auth

**Decision needed (default chosen):** product/store-price mutations are ingestion endpoints used by the scraper, not by end users. Default approach: require a service API key (`x-api-key` header checked against `config.ingestApiKey`) for ingestion routes, rather than user JWT. This keeps the scraper simple and blocks the public.

- [ ] **Step 1:** Add `ingestApiKey: process.env.INGEST_API_KEY` to `config/index.ts` (throw in production if unset).
- [ ] **Step 2:** Create `cheep-backend-express/src/middleware/ingest-auth.middleware.ts`:

```ts
import { type Request, type Response, type NextFunction } from 'express';
import { config } from '../config/index.js';

export const requireIngestKey = (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('x-api-key');
    if (!config.ingestApiKey || key !== config.ingestApiKey) {
        return res.status(401).json({ success: false, message: 'Invalid or missing API key' });
    }
    next();
};
```

- [ ] **Step 3:** Apply `requireIngestKey` to: `POST /`, `POST /upsert`, `PUT /:id`, `DELETE /:id`, `POST /merge`, `POST /admin/generate-fingerprints` in `products.routes.ts`, and `POST /upsert`, `POST /bulk-upsert`, `POST /import-with-llm` in `store-prices.routes.ts`.
- [ ] **Step 4:** Update the scraper's HTTP client to send `x-api-key` (see Task 4.4).
- [ ] **Step 5:** Verify a write request without the key returns 401.
- [ ] **Step 6:** Commit: `fix(backend): require API key for product/price ingestion endpoints`.

### Task 1.3: Fix IDOR in list compare/useRoute

- [ ] **Step 1:** In `lists-compare.controller.ts` `compareList`, scope the update by owner. Replace the `prisma.list.update` (line ~35) with `updateMany` so it cannot touch other users' lists:

```ts
await prisma.list.updateMany({
    where: { id: parseInt(id), user_id: req.user.id },
    data: { last_compared_at: new Date() },
});
```

- [ ] **Step 2:** In `useRoute` (line ~65), do the same and assert a row was affected:

```ts
const result = await prisma.list.updateMany({
    where: { id: parseInt(id), user_id: req.user.id },
    data: { status: 'completed', completed_at: new Date() },
});
if (result.count === 0) {
    res.status(404).json({ success: false, message: 'Liste bulunamadı' });
    return;
}
```

- [ ] **Step 3:** Audit every other `prisma.list.*` / `prisma.list_item.*` call in `lists.service.ts` and `lists.controller.ts` for the same `user_id` scoping; fix any unscoped read/update/delete.
- [ ] **Step 4:** Verify: as user A, calling `useRoute` on user B's list id returns 404, not 200.
- [ ] **Step 5:** Commit: `fix(backend): close IDOR on list compare/useRoute and audit list ownership scoping`.

### Task 1.4: Harden JWT secret handling

- [ ] **Step 1:** In `config/index.ts`, remove the hardcoded fallback and fail fast in **all** environments when `JWT_SECRET` is missing or `< 32` chars (keep a clearly-labeled dev default ONLY when `NODE_ENV !== 'production'` AND log a loud warning, or — preferred — require it always and document it in `.env.example`).
- [ ] **Step 2:** Verify the server refuses to boot in production without a strong secret.
- [ ] **Step 3:** Commit: `fix(backend): fail fast on weak/missing JWT secret`.

### Task 1.5: Lock down CORS

- [ ] **Step 1:** In `index.ts`, replace `app.use(cors())` with an allowlist:

```ts
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true, // `true` reflects origin in dev
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
```

- [ ] **Step 2:** Document `ALLOWED_ORIGINS` in `.env.example`.
- [ ] **Step 3:** Commit: `fix(backend): restrict CORS to configured origins`.

### Task 1.6: Always rate-limit (remove dev skip)

- [ ] **Step 1:** In `rate-limit.middleware.ts`, remove or invert the `skip: () => process.env.NODE_ENV !== 'production'` so the general limiter also runs outside production (raise its `max` if dev needs headroom). Keep authLimiter strict.
- [ ] **Step 2:** Commit: `fix(backend): apply rate limiting in all environments`.

---

## Phase 2 — Backend Correctness & Robustness

**Files:** `lists.service.ts`, `index.ts`, `compare-engine.service.ts`, `error.middleware.ts`, `utils/prisma.client.ts`.

### Task 2.1: Wrap multi-step list mutations in transactions

- [ ] **Step 1:** In `lists.service.ts`, the "only one active list" logic (the `updateMany` to complete old + `create` new, ~lines 147–160) must be atomic. Wrap in `prisma.$transaction([...])` or `prisma.$transaction(async (tx) => {...})`.
- [ ] **Step 2:** Do the same for `replaceWithCompletedList` (delete old + create, ~line 430).
- [ ] **Step 3:** Verify lists still create/replace correctly.
- [ ] **Step 4:** Commit: `fix(backend): make list create/replace atomic via transactions`.

### Task 2.2: Graceful shutdown + Prisma disconnect

- [ ] **Step 1:** In `index.ts`, capture `const server = app.listen(...)` and add SIGTERM/SIGINT handlers that `server.close()` then `await prisma.$disconnect()` then `process.exit(0)`.
- [ ] **Step 2:** Add `process.on('unhandledRejection')` / `uncaughtException` logging via Winston.
- [ ] **Step 3:** Commit: `feat(backend): graceful shutdown and global error logging`.

### Task 2.3: Stop leaking stack traces in HTTP responses

- [ ] **Step 1:** In `error.middleware.ts`, log the stack via Winston but never include `error.stack` in the JSON response body. Return a stable shape `{ success: false, message }` (+ `errors` array for validation).
- [ ] **Step 2:** Commit: `fix(backend): never expose stack traces in responses`.

### Task 2.4: Bound compare-engine combinatorics + fix Decimal handling

- [ ] **Step 1:** In `compare-engine.service.ts`, confirm store-combination generation is capped (e.g. only consider the top-K cheapest stores per product, never 2^N over all stores). If unbounded, add a hard cap (`maxStores` already exists — ensure combination generation respects it and the candidate store set is pre-filtered).
- [ ] **Step 2:** Replace `parseFloat(sp.price)` on Prisma `Decimal` with `Number(sp.price)` / `sp.price.toNumber()` consistently for price math (`lists.service.ts`, compare engine).
- [ ] **Step 3:** Remove the `as unknown as ProductInList[]` cast (compare-engine ~line 151) by typing the Prisma query result properly (use Prisma's generated payload types via `Prisma.ListGetPayload<...>`).
- [ ] **Step 4:** Commit: `fix(backend): bound compare combinatorics and unify Decimal math`.

---

## Phase 3 — Cleanup & Dead Code

### Task 3.1: Remove duplicate mobile architecture (Expo Router boilerplate)

**Files:** delete `Cheep-Mobile/app/` directory (unused — entry is `index.js` → `App.tsx` → `src/navigation/RootNavigator`). Also remove unused boilerplate components under `Cheep-Mobile/components/` and `Cheep-Mobile/hooks/` that are only referenced by `app/`.

- [ ] **Step 1:** Grep to confirm nothing under `src/` imports from `app/`, `components/` (root), or `hooks/` (root). (`Grep "from '\\.\\./\\.\\./components"` etc.)
- [ ] **Step 2:** Delete `Cheep-Mobile/app/` and any root-level boilerplate (`components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `themed-*.tsx`, `external-link.tsx`, `haptic-tab.tsx`, `ui/collapsible.tsx`, `hooks/use-*`) only after confirming zero references.
- [ ] **Step 3:** Remove `expo-router` from `package.json` if no longer referenced; ensure `main` is `index.js`.
- [ ] **Step 4:** Verify `npx tsc --noEmit` and `npx expo start` still bundle.
- [ ] **Step 5:** Commit: `chore(mobile): remove unused Expo Router boilerplate and dead components`.

### Task 3.2: Remove dead HomeScreen, fake data, unused state

- [ ] **Step 1:** Delete `Cheep-Mobile/src/screens/home/HomeScreen.tsx` (only `NewHomeScreen` is wired in `HomeNavigator`). Update `src/screens/home/` `index.ts` if it re-exports it.
- [ ] **Step 2:** In `NewHomeScreen.tsx`, replace `Math.random()` fake distance (line ~573) with either real geo distance (Phase 6 feature) or remove the distance display until real data exists.
- [ ] **Step 3:** Wire the unused `setLoading` state into an actual loading indicator (line ~67), and surface caught errors to the user (line ~289) instead of only `console.error`.
- [ ] **Step 4:** Commit: `chore(mobile): remove dead HomeScreen and fake distance; wire loading/error UX`.

### Task 3.3: Resolve ESLint config conflict

- [ ] **Step 1:** Keep ONE config. Recommended: keep the flat `eslint.config.mjs` (modern) and delete both `eslint.config.js` and `.eslintrc.js`; OR keep `.eslintrc.js` and delete the two flat configs. Pick whichever currently lints without error.
- [ ] **Step 2:** Run `npx eslint .` and fix or `// eslint-disable` egregious issues; ensure `pnpm lint`/`npm run lint` works.
- [ ] **Step 3:** Commit: `chore(mobile): consolidate ESLint to a single config`.

### Task 3.4: Remove unused backend dependencies

- [ ] **Step 1:** Confirm `typeorm`, `reflect-metadata`, `class-validator`, `class-transformer`, and one of `bcrypt`/`bcryptjs` are unused (grep imports). Keep `bcryptjs` (matches existing usage), drop `bcrypt`.
- [ ] **Step 2:** Remove them from `package.json`, `pnpm install`, verify `tsc --noEmit` + boot.
- [ ] **Step 3:** Commit: `chore(backend): drop unused dependencies`.

---

## Phase 4 — Config & Developer Experience

### Task 4.1: Backend `.env.example`

- [ ] **Step 1:** Create `cheep-backend-express/.env.example` documenting: `PORT`, `DATABASE_URL`, `JWT_SECRET` (note: min 32 chars), `JWT_EXPIRATION_TIME`, `NODE_ENV`, `ALLOWED_ORIGINS`, `INGEST_API_KEY`, `OPENAI_API_KEY`/`OPENROUTER_API_KEY`, `LLM_MODEL`.
- [ ] **Step 2:** Commit: `docs(backend): add .env.example`.

### Task 4.2: Mobile API URL via env/app config

- [ ] **Step 1:** Replace the hardcoded IP in `Cheep-Mobile/src/constants/api.ts` with `expo-constants` extra config: read `Constants.expoConfig?.extra?.apiUrl` with a sensible dev fallback.
- [ ] **Step 2:** Add `extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1' }` to `app.json`/`app.config.js` (convert `app.json` to `app.config.js` if env interpolation is needed), and add `EXPO_PUBLIC_API_URL` to a new `Cheep-Mobile/.env.example`.
- [ ] **Step 3:** Verify the app reads the configured URL.
- [ ] **Step 4:** Commit: `feat(mobile): configurable API base URL via env`.

### Task 4.3: Scraper config hygiene

- [ ] **Step 1:** Pin `Cheep-Scraper/requirements.txt` to exact versions (`==`) or generate via `pip freeze`.
- [ ] **Step 2:** Add `RotatingFileHandler` (10MB × 5) to the LLM matcher logging; make log level read from `LOG_LEVEL` env (default INFO, not hardcoded DEBUG).
- [ ] **Step 3:** Move hardcoded `BATCH_SIZE`, embedding model, timeouts, and Cloudflare wait times to env/config; fix the `300 vs 150` comment/code mismatch.
- [ ] **Step 4:** Replace bare `except:`/`except: pass` (carrefour scraper ~550, 652, 715) with specific exceptions + `logger.warning`.
- [ ] **Step 5:** Add a per-`.gitignore` comment explaining `browser_data/` is regenerated and must never be committed; verify it stays ignored.
- [ ] **Step 6:** Commit: `chore(scraper): pin deps, add log rotation, configurable params, real exception handling`.

### Task 4.4: Scraper → backend ingestion auth

- [ ] **Step 1:** In the scraper's backend-upload code, read `INGEST_API_KEY` from env and send it as `x-api-key` on every POST to `/products`, `/store-prices/*`.
- [ ] **Step 2:** Add `INGEST_API_KEY` to `Cheep-Scraper/.env.example`.
- [ ] **Step 3:** Implement the empty `_create_new_subcategories` TODO (scalable-llm-matcher ~1203) to actually POST to the backend `/categories` endpoint, or explicitly log that auto-creation is disabled.
- [ ] **Step 4:** Commit: `feat(scraper): authenticate ingestion calls and implement subcategory creation`.

---

## Phase 5 — Tests (safety net)

**Goal:** Establish test infra in each subsystem and cover the highest-risk logic. Use TDD for any new feature code in Phase 6.

### Task 5.1: Backend test harness + critical unit tests

- [ ] **Step 1:** Add `vitest` (or `jest` + `ts-jest`) to `cheep-backend-express`, with a `test` script and a test DB strategy (mock Prisma via `vitest-mock-extended`, or a dedicated test schema).
- [ ] **Step 2:** Write unit tests for: password hash/verify + JWT issue/verify (`auth.service`); list-ownership scoping (the IDOR fix from 1.3); compare-engine scoring math on a fixed fixture; `product-matcher` Levenshtein/Jaccard/fingerprint on known pairs.
- [ ] **Step 3:** Add a few supertest integration tests: register→login→authed request happy path; unauthenticated write → 401; cross-user list access → 404.
- [ ] **Step 4:** Commit per logical group.

### Task 5.2: Mobile test harness

- [ ] **Step 1:** Add `jest-expo` + `@testing-library/react-native`.
- [ ] **Step 2:** Test `AuthContext` (login stores token, logout clears, bootstrapping), `api.client` interceptors (token injected, 401 clears token), and one screen smoke test.
- [ ] **Step 3:** Commit.

### Task 5.3: Scraper tests

- [ ] **Step 1:** Add `pytest`; replace the live `test_migros.py` with mocked-response tests (use saved JSON fixtures).
- [ ] **Step 2:** Unit-test the matcher's pure functions: size normalization, `_string_similarity`, exact-match phase, with fixtures (no network/LLM).
- [ ] **Step 3:** Commit.

### Task 5.4: CI

- [ ] **Step 1:** Add `.github/workflows/ci.yml` running typecheck+tests for backend, typecheck+tests for mobile, and `pytest` for scraper on push/PR.
- [ ] **Step 2:** Commit: `ci: add GitHub Actions for all three subsystems`.

---

## Phase 6 — Feature Backlog ("market leader") — CONFIRM BEFORE BUILDING

These are prioritized by impact for a price-comparison product. Each will get its own detailed TDD sub-plan once selected. **Do not build until the user picks.**

1. **Price history + drop alerts.** Add a `price_history` table (product_id, store_id, price, captured_at) written on every ingest; expose `GET /products/:id/history`; mobile sparkline chart; push notification when a watched product's price drops below a threshold. *Highest differentiation; leverages data already being scraped.*
2. **Real geolocation & store proximity.** Add lat/lng to stores, use device location (expo-location) to compute real distance (replaces `Math.random()`), feed real distances into the route optimizer. *Makes the TSP route optimizer actually meaningful.*
3. **Barcode scanning** (expo-camera/expo-barcode-scanner) → instant price comparison via `GET /products/barcode/:barcode` (already exists). *Strong in-store UX.*
4. **Favorites / watchlist + budget tracking.** Persist favorite stores (already partly modeled) and a watchlist; show projected basket cost vs budget in real time.
5. **Caching layer** (React Query on mobile + short-TTL server cache / Redis for compare results) to cut latency and LLM/DB load.
6. **Scrape freshness & scheduling.** Track `last_updated_at` per price, show "fiyat X saat önce güncellendi", schedule scrapers (cron) and surface stale-data warnings.
7. **Token refresh flow** on mobile (refresh token + silent re-auth on 401 instead of forced logout).
8. **Deals screen implementation** (currently placeholder) powered by biggest price drops / cross-store savings.
9. **Profile screen actions** (the 4 TODOs: edit profile, favorite stores, settings, about).
10. **Offline support** (cache last lists/prices, queue mutations).

---

## Self-Review Notes

- Spec coverage: security (1), correctness (2), cleanup (3), config/DX (4), tests (5), new features (6) — all four user-selected areas plus feature backlog are covered.
- Open decisions surfaced for the user: (a) ingestion auth = API key vs user JWT (default: API key); (b) which Phase 6 features to build; (c) ESLint flat vs legacy config choice.
- Naming consistency: `requireIngestKey`, `INGEST_API_KEY`, `ALLOWED_ORIGINS`, `EXPO_PUBLIC_API_URL` used consistently across backend, scraper, and mobile tasks.
