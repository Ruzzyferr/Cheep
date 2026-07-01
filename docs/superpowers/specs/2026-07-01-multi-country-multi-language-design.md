# Cheep — Multi-Country & Multi-Language Expansion

**Date:** 2026-07-01
**Branch:** `multi-country`
**Status:** Design (approved for spec review)

## 1. Goal

Take Cheep from a Turkey-only grocery price-comparison app to a **multi-country, multi-language** product. A user in Turkey sees Turkish markets and prices in ₺; a user in Germany sees German markets in €; a Turk living in Germany can use a **Turkish UI** while shopping **German markets in €**. Grocery price data for each country is scraped weekly (Sunday→Monday night) and served country-scoped.

## 2. Scope: country / language / currency / market matrix

Initial launch set (framework makes adding more countries data-only, not code):

| Country | UI lang(s) | Currency | Anchor chains (full online catalog) | Best-effort (leaflet/hard) |
|---|---|---|---|---|
| 🇹🇷 Turkey *(existing)* | tr | TRY | Migros, CarrefourSA, A101, ŞOK | BİM |
| 🇨🇭 Switzerland | de | CHF | Migros CH, Coop | Denner, Aldi/Lidl Suisse |
| 🇸🇪 Sweden | sv | SEK | ICA, Willys, Coop, Hemköp | City Gross |
| 🇩🇪 Germany | de | EUR | REWE, Kaufland | Aldi Süd/Nord, Lidl, Penny, Netto, Edeka |
| 🇵🇱 Poland | pl | PLN | Carrefour PL, Auchan, Kaufland PL, Frisco | Biedronka, Lidl PL, Dino, Żabka |

**UI languages shipped:** `tr, en, de, pl, sv` (`en` = universal fallback). Switzerland starts on `de`; `fr`/`it` can be added later as data-only locale files.

**User decision (2026-07-01):** attempt **every** market including hard discounters (best-effort, graceful degradation), not only the scrapeable anchors.

## 3. Core architecture decisions

### 3.1 Language is decoupled from country
Two independent axes, both chosen in onboarding (smart-defaulted) and both changeable in Profile:
- **Country** — resolved from geolocation (`geo.ts` reverse-geocode) or explicit selection. Drives: which stores/products/prices are visible (`x-country` header), and **currency**.
- **Language** — defaults from device locale (`expo-localization`), falls back to `en`. Drives: UI strings (i18n). Never affects prices/markets.

Persisted in storage (`USER_COUNTRY`, `USER_LANGUAGE`) and mirrored to the backend user record (`user.country_id`, `user.language`).

### 3.2 EAN-barcode-first product matching (language-agnostic)
The Turkish pipeline relies on a 900+ entry Turkish category dictionary + Turkish text normalization. We do **not** rebuild that per language. For new countries:
1. **Primary key = EAN-13 barcode** (`Product.ean_barcode`, already `@unique`). European retail catalogs expose EAN; barcode equality is language-neutral and exact.
2. **Fallback = normalized name + brand + quantity** (reuse `scrapers/units.py`, which is already language-agnostic).
3. **Category** = a shared canonical taxonomy; category *names* are localized in the UI via i18n, not stored per language. Per-country raw→canonical mapping is thin (only what a chain's own category strings require), not a 900-entry dictionary.

### 3.3 Countries/markets are data, not code
Adding a country = a `countries/<code>/config.json` + seed rows + locale file + (optional) new scraper classes. No architectural change. The mobile app renders whatever the country-scoped API returns.

## 4. Backend changes (`cheep-backend-express`)

Schema is already multi-country (`Country{code,name,currency}`, `Store.country_id`, `Product.country_id`, `User.country_id`). `x-country` middleware is globally mounted. Gaps to close:

1. **Route/basket optimizer country-scoping (CRITICAL).** `compare-engine.service.ts` fetches `store_prices` with no country constraint → can mix stores across countries. Filter list-item `store_prices` by `store.country_id === req.country.id`.
2. **Individual product queries.** `getProductById`, `getProductByBarcode`, `getProductPrices`, price-history — add country scoping so a product/prices from another country can't leak.
3. **Currency out of the model, not hardcoded.** Replace hardcoded `TL`/`₺` in `assistant.service.ts`, `assistant.tools.ts`, `llm-product-matcher.service.ts` with the resolved `Country.currency`. API responses expose the active country's `currency` (and code) so the client formats correctly.
4. **User preferences.** Add `language` column to `User` (migration). Endpoints to set `user.country_id` and `user.language`. Country resolution order: `x-country` header → `user.country_id` → `DEFAULT_COUNTRY_CODE`.
5. **Create/ingest schemas.** `createProductSchema` / `createStoreSchema` / bulk-upsert accept `country_code` (default = header). Importer must land data under the correct country.
6. **Seed.** Add countries CH (CHF), SE (SEK), DE (EUR) [PL already seeded] and their store rows (name, logo_url, website_url, country_id) for all chains in the matrix.

## 5. Mobile changes (`Cheep-Mobile`)

1. **i18n infrastructure.** Add `i18next` + `react-i18next` + `expo-localization`. `src/locales/{tr,en,de,pl,sv}.json`. All hardcoded Turkish UI strings move to `t()` keys. `tr.json` is the source of truth; other files translated from it.
2. **Locale/currency layer.** `src/context/LocaleContext.tsx` (or an i18n-adjacent helper) exposing `formatMoney(amount)`, `formatNumber`, `formatDate` driven by the **active country's** currency + an appropriate `Intl` locale. Replace all 35+ hardcoded `₺` / `toLocaleString('tr-TR')`.
3. **Language selection in onboarding.** New first step: language (default device locale → `en`). Country step (default geo-detected) with manual override. Saved to storage + backend.
4. **Profile language & country switchers.** Under Profile: change UI language and country; app re-renders live (i18n) and re-fetches country-scoped data.
5. **Country-aware store logos.** `getStoreLogoAsset` → `getStoreLogoAsset(country, storeName)` backed by per-country asset folders (`assets/images/{TR,CH,SE,DE,PL}Companies/`). No cross-country fallback (never show a wrong-country logo). Missing logo → branded initials badge.
6. **Currency/locale correctness** across ProductCard, deals, compare results, onboarding budget input, intro example prices, etc.

## 6. Scraper changes (`Cheep-Scraper`)

1. **Per-country package.** `countries/{ch,se,de,pl}/` each with `config.json` (markets, store_ids, scraper paths) + copied `run_scrapers.py` / `run_matcher.py` / `import_to_backend.py`, `COUNTRY_CODE` set.
2. **Scraper classes per chain.** Implement real scrapers for every chain in the matrix (Section 2), best-effort:
   - **Anchors** (full online catalog): real product+price+EAN scrapers — the reliable core.
   - **Hard discounters** (Biedronka, Aldi, Lidl, Dino, Denner…): attempt catalog; where only weekly-offer/leaflet data exists, ingest that (flagged `source=leaflet`); where nothing is available, the config entry is scaffolded + disabled with a note. Graceful degradation, never a hard failure.
3. **EAN-first matcher** (Section 3.2). New countries route through barcode matching + language-agnostic unit parsing; thin per-country raw-category maps only.
4. **Store IDs.** Allocate non-overlapping `store_id` ranges per country (e.g. TR 1–9, CH 10–19, SE 20–29, DE 30–39, PL 40–49) so ingestion links prices unambiguously.

## 7. Scheduler (weekly, Sunday→Monday night)

Runs on the existing DigitalOcean droplet (167.71.36.167, Docker Compose). A weekly job runs, per country, `run_scrapers → run_matcher → import_to_backend`.
- **Cadence:** once weekly, night between Sunday and Monday.
- **Default:** cron `0 2 * * 1` UTC (~03:00 CET, ~05:00 Istanbul), countries **staggered** (e.g. +30 min each) to avoid resource contention. Exact time/timezone confirmed at spec review.
- **Mechanism:** a scheduler container/service (cron in a container, or systemd timer on the host) invoking a `run_all_countries` orchestration script. Logs per country/run; failures isolated per country (one country failing doesn't block others).
- **Deploy:** this **requires a server deploy** (new scraper code + scheduler onto the droplet), unlike prior mobile-only work.

## 8. Testing strategy

- **Backend:** unit/integration tests for country-scoping (compare-engine must never mix countries; product/price queries country-bound); currency resolved from model. Seed provides CH/SE/DE/PL stores for test fixtures.
- **Mobile:** Playwright RN-web harness with seeded per-country data — verify a PL-country session shows only PL stores in PLN with Polish UI; switching language in Profile re-renders; switching country re-fetches. Currency/format assertions.
- **Scraper:** per-chain scrapers validated against saved sample payloads (fixtures) where live access is blocked; anchor chains validated end-to-end where reachable. Honest logging of chains that yield no data.

## 9. Phasing

**Phase 1 — Country & Language Platform.** Sections 4 + 5 + seed data. Fully buildable and testable here with seed/mock data. Ships "users see only their country's markets, in their language and currency" before any new scraped data exists. **Highest value, lowest risk — done first.**

**Phase 2 — Data pipeline.** Sections 6 + 7. Per-country scrapers (anchors first, then best-effort discounters), EAN matcher, weekly scheduler, droplet deploy. Iterative, chain-by-chain.

Each phase gets its own implementation plan.

## 10. Risks & honesty notes

- **Foreign scrapers are brittle and can't be deep-tested from here** (geo-blocking, anti-bot, Cloudflare). Anchor chains are the dependable core; hard discounters may yield only leaflet data or none. "Every market" is pursued best-effort, not guaranteed.
- **Category taxonomy across languages** is simplified via EAN + shared canonical categories; some mis-categorization is expected until per-country raw-category maps are tuned.
- **Scheduler needs a droplet deploy** and live credentials (handled only via gitignored `.env`, never committed). Secrets flagged for rotation stay out of git.
- **Currency conversion is NOT done** — each country's prices are shown in its own currency; no cross-currency conversion or comparison.
- **Translation quality:** initial non-Turkish locale files are best-effort translations from `tr.json`; native review recommended before public launch per market.

## 11. Out of scope (YAGNI)

- Cross-currency conversion / "cheapest across countries".
- Region/store-level pricing within a country beyond what a chain's API naturally exposes (e.g. REWE PLZ, ICA per-store) — used if free, not engineered further now.
- Switzerland `fr`/`it`, and countries beyond the initial five — trivially addable later as data.
- Native-quality localization QA and legal/GDPR per-market review (tracked separately before public launch).
