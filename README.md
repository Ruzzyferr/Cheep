# 🐦 Cheep — Intelligent Grocery Price Comparison

**A full-stack, multi-country platform that turns official grocery-price data into the cheapest way to fill your basket — with route optimization, an AI shopping assistant, real store geolocation, and a polished mobile app.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Expo](https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white)](https://expo.dev/)

---

## Overview

Cheep tells shoppers **where to buy each item on their list for the lowest total cost**. It aggregates grocery prices across the national chains of a country, compares them item-by-item, and computes an optimal shopping route — one store or a short multi-store trip — scored on price, coverage, distance, and budget.

The Türkiye catalog is built **entirely from the official government price-transparency service** ([marketfiyati.org.tr](https://marketfiyati.org.tr), run by TÜBİTAK BİLGEM for the Ministry of Trade), which every 200+-branch chain is legally required to feed. That means **first-party, authoritative prices** — the same product carries one barcode across every chain, so cross-store comparison is exact rather than guessed. The platform is **country-aware** and extends chain-by-chain across Europe, showing each user the chains, currency, and prices of the country they're in.

### The Problem

A weekly grocery basket is almost never cheapest at a single store, but checking six chains by hand is infeasible — and once you factor in which stores are actually near you and how far apart they are, "cheapest" becomes a real optimization problem, not a lookup.

### The Solution

An ingestion layer that keeps an authoritative catalog fresh, a **compare engine** that allocates each item to its cheapest store and solves a Traveling-Salesman-style route across a short list of stops, and a **mobile app** that presents the result as clear, rankable shopping strategies. On top sits a **Gemini-powered assistant** that builds and prices lists in natural language, personalized by a per-user diet / allergen / budget profile.

---

## Highlights

- 🏛️ **Official-data catalog** — 16k+ Türkiye products across 6 national chains (BİM, A101, ŞOK, Migros, CarrefourSA, Tarım Kredi Market), 8 top / 80 sub categories, all derived from the government API. Real product imagery is served from the official CDN; chains are shown as legal, copyright-safe brand badges (no third-party logos).
- 🧭 **Route optimization** — single- and multi-store strategies, each item routed to its cheapest store, TSP-ordered by real driving distance, ranked by a 7-factor score. Redundant routes that collapse to the same store set are de-duplicated so every option is distinct.
- 📍 **Real store geolocation** — nearest branch of each chain from OpenStreetMap/Overpass data (`StoreBranch`), so distances reflect the actual shop near you, not a chain HQ.
- 🤖 **AI shopping assistant** — a tool-calling Gemini agent manages lists in plain language, strictly scoped server-side to the authenticated user.
- 📈 **Price history & deals** — every price change is recorded to a time series; the app renders per-product trends and surfaces the biggest cross-store savings.
- 🌍 **Multi-country / multi-language** — country is a first-class entity; the app localizes UI, currency, and catalog across TR / CH / SE / DE / PL (tr / en / de / pl / sv).
- 🔒 **Production-grade security** — rotating, revocable JWT refresh tokens; helmet headers; validated, owner-scoped, injection-safe queries; API-key-guarded ingestion.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                             CHEEP — Full-Stack System                            │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   OFFICIAL DATA                 INGESTION                 API            CLIENT   │
│                                                                                  │
│  marketfiyati.org.tr ─┐                                                          │
│  (TR gov, first-party)│    ┌───────────────────┐   ┌──────────────┐  ┌────────┐ │
│                       ├──▶ │  fetch → ingest    │──▶│cheep-backend │─▶│ Mobile │ │
│  Foreign scrapers ────┘    │  daemon (Python)   │   │  (Express +  │  │(RN/Expo)│ │
│  (CH/SE/DE/PL)             │  EAN-keyed upsert  │   │   Prisma)    │◀─│        │ │
│                            └───────────────────┘   └──────┬───────┘  └────────┘ │
│  (extensible: optional      staleness prune,              │                     │
│   Kafka/Avro pipeline +     weekly refresh          ┌─────▼──────┐              │
│   LLM matching for                                  │ PostgreSQL │              │
│   messy scraped data)                               └────────────┘              │
│                                                                                  │
│  • Compare engine (single/multi-store, TSP route, 7-factor score, dedupe)        │
│  • Country multi-tenancy (x-country)   • AI assistant (Gemini, user-scoped)      │
│  • Real branch geodistance (OSM)       • Profile / onboarding / diet constraints │
│  • Price history + deals               • JWT access+refresh (rotated, revocable) │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Highlights

### 1. Authoritative Data Ingestion
The Türkiye catalog is rebuilt from the government API's public sitemap (~33k product IDs → the priced subset), fetched two-phase (**fetch** raw JSON → **ingest** into the API) so ingestion is idempotent and replayable. A **continuous fetch daemon** keeps prices fresh with AIMD rate-shaping (backs off under the WAF threshold), a persistent state store (new-first, then time-to-live rotation of priced/empty IDs), and **staleness pruning** that removes products the source no longer lists. Product images come from the official CDN and are URL-sanitized on the way in.

### 2. EAN-First, Country-Scoped Matching
Because the government data gives every product a single barcode across all chains, matching is **exact**: the backend keys products on `@@unique([country_id, ean_barcode])` and merges store prices onto one product. The request's country (`x-country`) is threaded through the whole ingestion path, so a barcode in two countries stays two distinct products. For messier **foreign scraped** sources, an optional **LLM + fuzzy pipeline** (embeddings, Turkish-aware normalization, fingerprinting) and an **event-driven Kafka/Avro** ingestion path remain available in the codebase for chain-by-chain expansion.

### 3. Route Optimization & Comparison
The compare engine builds, for each list, every sensible **single-store** and **multi-store** strategy: each item is allocated to its cheapest store in the set, the stops are TSP-ordered by real branch distance, and each strategy is scored on **price, coverage, distance, store count, favorites, budget, and a missing-item penalty**. Combinatorics are bounded (candidate stores capped, `maxStores` clamped), and strategies that collapse to the same effective store set are **de-duplicated** so the user sees each distinct option once. Comparisons are **coverage-aware** — a cheaper route that skips items never outranks a complete basket.

### 4. Real Store Geolocation
A dedicated `StoreBranch` table holds real branch coordinates imported from OpenStreetMap/Overpass (full-word brand-token matching to avoid alias over-match; bbox widening for rural areas). Given the user's location, the engine swaps each chain's coordinate for its **nearest branch**, so both the distance score and the displayed "X km away" reflect reality.

### 5. AI Shopping Assistant (Gemini)
A **tool-calling agent** lets users manage lists conversationally ("add the cheapest milk and eggs to my weekly list"). A bounded agent loop drives Gemini's function calls; every tool (`create_list`, `add_items_to_list`, `get_list`, …) is **scoped server-side to the authenticated user** — the model never supplies a user id, so it cannot reach another user's data. Tool batches are capped, provider errors are sanitized before reaching the client, and a **daily message limit** is enforced before the model call. Threads and messages are persisted per user.

### 6. Personalization — Profile & Onboarding
A mascot-guided **onboarding wizard** captures household size, diet, allergens, and weekly budget. A pure, category-heuristic **constraint evaluator** annotates products with diet/allergen warnings, surfaced as badges across the app and woven into the assistant's prompt.

### 7. Mobile Experience
React Native / Expo, fully localized across five languages with currency from the country entity. A premium, cream-and-forest fintech design system: an infinite-scroll category grid, distinct per-category iconography (with a graceful category-icon fallback when a product has no image), fixed-layout product cards, a cart badge and quick add-to-list with lightweight toasts, price-trend charts, a deals feed, and coverage-clear route comparison.

### 8. Security & Quality
JWT **access + refresh** tokens with silent re-auth, where refresh tokens are **rotated and revocable**: a per-user `token_version` invalidates all outstanding refresh tokens on **logout** or **password change**, and refresh tokens are signed with a **separate secret** (type-claim isolation so a refresh token can't act as an access token). Plus **helmet** headers, Joi validation with `stripUnknown` (mass-assignment-safe), **API-key-guarded ingestion**, owner-scoped queries (IDOR-safe), parameterized SQL (`Prisma.sql`), a CORS allowlist, rate limiting, and graceful shutdown. The backend builds clean under `tsc`, ships **vitest** tests, and **GitHub Actions CI** runs typecheck/tests across all subsystems; the codebase has passed a multi-agent security audit with no exploitable auth-bypass / IDOR / injection findings.

---

## Project Structure

| Module | Stack | Description |
|--------|-------|-------------|
| **Cheep-Scraper** | Python | Two-phase official-data fetch + ingest daemon (marketfiyati.org.tr), taxonomy derivation, foreign-market scrapers, optional Kafka producer & LLM pipeline |
| **cheep-backend-express** | Node.js, Express, TypeScript, Prisma, PostgreSQL, Gemini | REST API, auth (+refresh rotation), EAN matching, compare engine & route optimizer, branch geodistance, AI assistant, profile |
| **Cheep-Mobile** | React Native, Expo | Cross-platform app: JWT+refresh, lists, route compare, price charts, geo, deals, AI chat, onboarding, i18n (5 languages) |
| **deploy** | Docker Compose, Caddy | Production deploy on a single droplet: API + Postgres + website behind Caddy (auto-HTTPS), plus the systemd fetch daemon |

---

## Quick Start

### Prerequisites
- Node.js 18+, Python 3.10+, PostgreSQL 14+ (Docker recommended for the DB)

### Backend
```bash
cd cheep-backend-express
cp .env.example .env          # DATABASE_URL, JWT_SECRET + JWT_REFRESH_SECRET (≥32 chars, distinct),
                              # ALLOWED_ORIGINS, INGEST_API_KEY, GEMINI_API_KEY
pnpm install
pnpm db:migrate:deploy        # applies migrations (country, price_history, profile, chat, token_version, …)
pnpm db:seed                  # seeds countries + anchor stores
pnpm dev                      # http://localhost:3000  (Swagger: /api-docs)
pnpm test                     # vitest unit tests
```

### Catalog (Türkiye — official data)
```bash
cd Cheep-Scraper
python -m venv venv && venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env                              # CHEEP_API_URL, INGEST_API_KEY
# Fetch official data → derive taxonomy → seed categories → ingest:
python countries/turkey/mf_fetch.py               # fetch raw product JSON
python countries/turkey/mf_taxonomy.py            # derive government category tree
python countries/turkey/mf_seed_categories.py     # create categories via the API
python countries/turkey/mf_ingest.py              # ingest products + prices + images
# Or run the continuous refresh daemon:
python countries/turkey/mf_daemon.py
```

### Mobile
```bash
cd Cheep-Mobile
npm install
cp .env.example .env           # EXPO_PUBLIC_API_URL (e.g. http://10.0.2.2:3000/api/v1 on Android emulator)
npx expo start
```

---

## Releasing (Android AAB / iOS IPA)

Builds are **local** (`gradlew`), not EAS. Native `android/` and `ios/` folders are
generated by `expo prebuild` and are **not** in git.

```bash
cd Cheep-Mobile
npx expo prebuild --platform android --clean
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Full step-by-step (signing, keystore, version bumps, Play Console, iOS, push
architecture, pre-release checklist): **[docs/BUILD-RELEASE.md](docs/BUILD-RELEASE.md)**

---

## API Documentation

- **Swagger UI**: `http://localhost:3000/api-docs`
- **Base URL**: `http://localhost:3000/api/v1`

Key endpoints: auth (register / login / **refresh** / **logout** / **change-password**), products (CRUD + **compare** + **history**), categories, stores (+ **nearby**), lists (with route compare), **profile** (diet/allergen/budget), **assistant** (chat threads + tool-calling messages), store-prices (API-key-guarded bulk ingest + **stale prune**). Send `x-country` to scope responses to a country.

---

## Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Ingestion** | Python, requests, Playwright, SQLite state, AIMD rate-shaping; optional confluent-kafka + OpenAI embeddings (foreign markets) |
| **Backend** | Express 5, TypeScript (ESM), Prisma, PostgreSQL, JWT, bcryptjs, Joi, helmet, Winston, vitest, Google Gemini |
| **Mobile** | React Native 0.81, Expo 54, React Navigation, i18next, Axios, expo-secure-store, expo-location |
| **Infra** | Docker Compose, Caddy (auto-HTTPS), systemd, GitHub Actions CI |

---

## License

MIT
