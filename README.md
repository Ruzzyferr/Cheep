# 🐦 Cheep — Intelligent Shopping Assistant

**A full-stack, multi-country price-comparison platform with LLM-powered product matching, route optimization, an event-driven ingestion pipeline, and a polished mobile app.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Apache Kafka](https://img.shields.io/badge/Kafka-231F20?style=flat&logo=apachekafka&logoColor=white)](https://kafka.apache.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)

---

## Overview

Cheep aggregates grocery prices from multiple retailers, uses **Large Language Models** to match equivalent products across stores, and computes **optimal shopping routes** so a user can fill a basket for the lowest total cost. It is **location/country-aware** — built to expand chain-by-chain across Europe (Türkiye: Migros, CarrefourSA, A101, ŞOK; Poland: Biedronka, Żabka, Lidl) and show each user the chains and prices of the country they're in.

### The Problem

Retailers use different naming conventions, units, and categories for the same products. A "Pınar Süt 1L" at Migros might appear as "Pinar Tam Yagli Sut 1 Litre" at CarrefourSA. Manually matching thousands of SKUs is infeasible; naive string matching fails on typos, abbreviations, and language variations. And the cheapest basket is rarely at a single store.

### The Solution

A **3-stage LLM pipeline** that normalizes product data, generates embeddings for cross-market matching, and consolidates categories — combined with a **7-factor scoring engine** and **TSP-based route optimization** to recommend the best stores and visit order for a given shopping list. Ingestion runs through a **country-partitioned, event-driven pipeline** (Kafka/Redpanda) so it scales market-by-market with fault isolation and replay.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              CHEEP — Full-Stack System                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  ┌──────────────┐   produce    ┌──────────────────────┐    REST     ┌───────────┐ │
│  │ Cheep-Scraper│ ───────────▶ │  Kafka / Redpanda     │            │Cheep-Mobile│ │
│  │   (Python)   │  raw.products│  (Avro, country-keyed)│            │ (RN/Expo)  │ │
│  └──────────────┘              └──────────┬────────────┘            └─────▲─────┘ │
│                                           │ normalize → match → persist          │ │
│                                           ▼                                  read │ │
│                                ┌──────────────────────┐    ┌───────────────────┐ │ │
│                                │ cheep-backend-express │───▶│  PostgreSQL        │─┘ │
│                                │ (Express + Prisma)    │    │  (Prisma)          │   │
│                                └──────────────────────┘    └───────────────────┘   │
│                                                                                    │
│  • Multi-store scraping    • Event-driven ingestion     • iOS / Android (Expo)    │
│  • 3-stage LLM pipeline    • REST API (JWT + refresh)   • Premium fintech UI      │
│  • Country-based config    • TSP route optimizer        • Price history charts    │
│  • Kafka producer          • 7-factor scoring           • Real geo distance       │
│                            • Country multi-tenancy      • Deals / compare         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Highlights

### 1. Event-Driven Ingestion Pipeline (Kafka / Redpanda)
Country-partitioned topics decouple the stages and make the catalog **replayable**:
```
scrapers → raw.products → [normalizer] → normalized.products → [matcher] → matched.products → [persister] → Postgres
                                                                                                    └→ price.events → [alerter]
```
- **Partitioned by country code** → per-country fault isolation and horizontal scale.
- **Avro + Schema Registry**, idempotent producer, **process-then-commit** consumers, bounded retry, **dead-letter topics**, and offset-reset **replay** (re-run improved matching without re-scraping).
- Runs on **Redpanda** locally (`docker-compose.kafka.yml`). The legacy synchronous HTTP bulk-import remains as a fallback/manual path.

### 2. LLM-Powered Product Matching
A scalable 3-stage pipeline: **(1)** LLM batch normalization & categorization (≈300 products/batch), **(2)** text embeddings + cosine similarity for cross-market matching, **(3)** LLM category consolidation. Supports OpenAI and OpenRouter. Plus a deterministic fuzzy matcher (Levenshtein + Jaccard + Turkish-aware normalization + fingerprinting) for typo-tolerant matching.

### 3. Route Optimization (TSP)
The compare engine solves a Traveling Salesman variant to minimize travel cost while maximizing savings, with **7-factor scoring** (total price, store count, distance, route efficiency, favorite-store bonus, missing-products penalty, budget compliance). Combinatorics are bounded (candidate stores capped, `maxStores` clamped) to stay fast as the store set grows.

### 4. Country Multi-Tenancy
`Country` is a first-class entity; `Store` and `Product` are country-scoped, and the API resolves the request's country from an `x-country` header (the mobile app derives it from device location via reverse-geocoding). Matching happens within a country — the same boundary as the Kafka partition.

### 5. Price History & Deals
Every price change is recorded to a `price_history` time series and emitted as a `price.events` event. The mobile app renders a per-product price trend, and the Deals screen surfaces the biggest cross-store savings.

### 6. Security & Quality
JWT **access + refresh** tokens with silent re-auth, Joi validation, **API-key-guarded ingestion** endpoints, owner-scoped queries (IDOR-safe), CORS allowlist, rate limiting, graceful shutdown. The backend builds clean under `tsc`, ships **vitest** unit tests, and **GitHub Actions CI** runs typecheck/tests across all three subsystems.

---

## Project Structure

| Module | Stack | Description |
|--------|-------|-------------|
| **Cheep-Scraper** | Python, OpenAI/OpenRouter, confluent-kafka | Web scraping, 3-stage LLM pipeline, Kafka producer (`INGEST_MODE=kafka`) |
| **cheep-backend-express** | Node.js, Express, TypeScript, Prisma, PostgreSQL, KafkaJS | REST API, auth (+refresh), compare engine, route optimizer, Kafka consumers |
| **Cheep-Mobile** | React Native, Expo | Cross-platform app: JWT+refresh, lists, compare UI, price charts, geo, deals |

---

## Quick Start

### Prerequisites
- Node.js 18+, Python 3.10+, PostgreSQL 14+
- (Optional, for the event pipeline) Docker

### Backend
```bash
cd cheep-backend-express
cp .env.example .env          # DATABASE_URL, JWT_SECRET (≥32 chars), ALLOWED_ORIGINS, INGEST_API_KEY, LLM keys
pnpm install
pnpm db:migrate:deploy        # applies migrations incl. feedback model, price_history, country
pnpm db:seed                  # seeds TR/PL + demo data
pnpm dev                      # http://localhost:3000  (Swagger: /api-docs)
pnpm test                     # vitest unit tests
```

### Event Pipeline (optional)
```bash
docker compose -f docker-compose.kafka.yml up -d   # Redpanda + Schema Registry + Console (:8080)
# in cheep-backend-express, set KAFKA_BROKERS=localhost:9092 SCHEMA_REGISTRY_URL=http://localhost:8081
pnpm consume:normalizer        # and consume:matcher / consume:persister (or consume:ingest)
```

### Scraper
```bash
cd Cheep-Scraper
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env           # OPENAI/OPENROUTER key, INGEST_API_KEY, optional KAFKA_BROKERS
# HTTP import:    python countries/turkey/import_to_backend.py
# Kafka producer: INGEST_MODE=kafka COUNTRY_CODE=TR python countries/turkey/import_to_backend.py
```

### Mobile
```bash
cd Cheep-Mobile
npm install
cp .env.example .env           # EXPO_PUBLIC_API_URL (e.g. http://10.0.2.2:3000/api/v1 on Android emulator)
npx expo start
```

---

## API Documentation

- **Swagger UI**: `http://localhost:3000/api-docs`
- **Base URL**: `http://localhost:3000/api/v1`

Key endpoints: auth (register / login / **refresh**), products (CRUD + compare + **history**), stores, lists (with compare), store-prices (API-key-guarded bulk/LLM import), feedback. Send `x-country` to scope responses to a country.

---

## Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Scraper** | Python, requests, Playwright, OpenAI API, text-embedding-3-small, confluent-kafka |
| **Backend** | Express 5, TypeScript (ESM), Prisma, PostgreSQL, KafkaJS + Schema Registry (Avro), JWT, bcryptjs, Joi, Winston, vitest |
| **Mobile** | React Native 0.81, Expo 54, React Navigation, Axios, expo-secure-store, expo-location |
| **Infra** | Redpanda (Kafka API), Docker Compose, GitHub Actions CI |
| **LLM** | OpenAI GPT-4o-mini, OpenRouter (multi-provider) |

---

## License

MIT
