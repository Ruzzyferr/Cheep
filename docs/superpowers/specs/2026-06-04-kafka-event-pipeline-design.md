# Cheep — Kafka Event-Driven Ingestion Pipeline (Design Spec)

**Status:** Approved (brainstorming) — pending implementation plan
**Date:** 2026-06-04
**Author:** Ruzgar Emir (with Claude)
**Related:** `docs/superpowers/plans/2026-06-04-cheep-overhaul.md`

---

## 1. Motivation & Honest Framing

Cheep aggregates grocery prices across stores and helps users find the cheapest basket. The vision is **incremental expansion across Europe** — each country has its own chains (Türkiye: Migros, CarrefourSA, A101, ŞOK; Poland: Biedronka, Żabka, Lidl), and the app is **location/country-scoped** (the user sees the chains and prices of the country they are in).

**Data freshness is low: store prices change roughly weekly.** Therefore there is *no real-time requirement*; periodic (daily-or-less) scraping is more than sufficient. At this data rate, Kafka is **above what the throughput strictly needs** — a scheduled job queue would suffice for pure ingestion.

The **explicit goal of this work is to learn and showcase Kafka / event-driven architecture** for the author's portfolio. Accordingly, Kafka is integrated **where it is genuinely defensible and demonstrates real understanding**, not cargo-culted:
- **Country-partitioned topics** map directly to the multi-country vision (fault isolation + horizontal scale per country).
- **Replayable log** delivers real value: the LLM matching logic can be improved and re-run over the entire history without re-scraping or touching Postgres.
- The pipeline showcases producers, topic design, partitioning, consumer groups, batched consumers, idempotency, dead-letter topics, retries, and schema evolution.

This spec states that trade-off explicitly so the architecture reads as a deliberate, mature choice rather than over-engineering.

---

## 2. High-Level Architecture

```
                         key = countryCode                  key = countryCode                 key = countryCode
scrapers (per country) ─▶ raw.products.v1 ─▶ [normalizer] ─▶ normalized.products.v1 ─▶ [matcher] ─▶ matched.products.v1 ─▶ [persister] ─▶ Postgres
   (Python producer)                                                                   (batched LLM)                          │
                                                                                                                              └─▶ price.events.v1 (key = productId) ─▶ [alerter] ─▶ push notifications
        every consumer:  on poison/exhausted-retry ─▶ <topic>.dlq
```

- The **scraper becomes a Kafka producer** instead of POSTing to the backend.
- A chain of **consumer services** (in the backend repo) each wrap existing business logic.
- The **HTTP API becomes read-mostly**: mobile reads from Postgres; ingestion flows through Kafka.

---

## 3. Topic Design & Partitioning

| Topic | Producer | Consumer | Key | Purpose |
|-------|----------|----------|-----|---------|
| `raw.products.v1` | Scrapers | normalizer | `countryCode` | Raw scraped record (name, price, store_sku, raw_category, store_id, image_url, scrapedAt) |
| `normalized.products.v1` | normalizer | matcher | `countryCode` | Normalized name/brand/size/category |
| `matched.products.v1` | matcher | persister | `countryCode` | Linked to muadil group / canonical product |
| `price.events.v1` | persister | alerter, analytics | `productId` | "Price persisted/changed" event (history + alerts) |
| `<topic>.dlq` | each consumer | manual/admin | — | Poison / unprocessable messages |

**Partitioning — the core decision:**
- Pipeline topics use **key = `countryCode`** (TR, PL, …):
  - Per-country **ordering** is guaranteed; one country's failure does not affect others (**fault isolation**).
  - **Horizontal scale** per country: add consumer instances; partitions distribute across them.
- Start with **12 partitions** on pipeline topics (countries hash across them; headroom for hundreds of chains). If one country dominates, switch to a custom partitioner pinning it to its own partition.
- `price.events.v1` uses **key = `productId`** — its consumers are product-centric and per-product ordering matters for alerts.

**Schema management:** Schema Registry with **Avro**. Topic names carry a version suffix (`.v1`). Compatibility mode **BACKWARD** (new fields optional / defaulted).

---

## 4. Components & Mapping to Existing Code

Consumers **wrap existing services** rather than reimplementing logic. This is enabled by the prior cleanup (clean build, `utils/similarity.ts` extraction).

| Component | Wraps existing | Input → Output |
|-----------|----------------|----------------|
| Scraper producer | `countries/*/import_to_backend.py` (HTTP → Kafka produce) | scrape → `raw.products.v1` |
| `normalizer` | `category-matcher.service`, text normalization (`cleanProductText`) | `raw` → `normalized` |
| `matcher` | `product-matcher.service` (fingerprint/similarity), `llm-product-matcher.service` | `normalized` → `matched` |
| `persister` | `store-prices.service.upsertStorePrice` (incl. price-history recording) | `matched` → Postgres + `price.events` |
| `alerter` | new (push notifications) | `price.events` → notifications |

**LLM batching nuance:** the LLM matcher batches products **per market** (≈300/batch) for cost efficiency. The `matcher` consumer uses Kafka **batch polling** (consume N records per poll), groups by store, and issues one LLM call per market group — never per-event.

**Backend HTTP API:** remains, but read-mostly. `bulk-upsert` / `import-with-llm` endpoints are kept as a **manual/fallback ingestion path and for tests** (still guarded by `INGEST_API_KEY`).

**Backend structure:**
```
cheep-backend-express/src/
  kafka/           # client, schema-registry, producer/consumer factory (shared)
  consumers/
    normalizer.ts  # separate entrypoint: npm run consume:normalizer
    matcher.ts
    persister.ts
    alerter.ts
  services/        # existing business logic (reused)
```

**Client libraries:** Node — `kafkajs` + `@kafkajs/confluent-schema-registry`. Python — `confluent-kafka` + Avro/schema-registry client.

---

## 5. Country / Location Multi-Tenancy

Country becomes a first-class dimension, consistent with the Kafka country-partitioning.

**Prisma model:**
```prisma
model Country {
  id        Int       @id @default(autoincrement())
  code      String    @unique   // ISO 3166-1 alpha-2: "TR", "PL"
  name      String              // "Türkiye", "Polska"
  currency  String              // "TRY", "PLN"
  stores    Store[]
  products  Product[]
}
```
- `Store` gains `country_id` (FK); already has `lat`/`lon`/`address`; optional `city` string.
- `Product` gains `country_id`. **Rationale:** comparison is always *within one country*; a Polish "Mleko 1L" and a Turkish "Süt 1L" are distinct catalog entries. The matcher matches **within a country** — the same boundary as the Kafka country partition.
- `User` gains optional `country_id` (preferred country).
- Migration backfills all existing data to `TR`.

**Location → country routing (mobile):**
- `Location.reverseGeocodeAsync(coords)` (expo-location, already added) returns `isoCountryCode` → no extra service.
- Fallback: user manually selects country; selection stored in SecureStore.
- API client sends `x-country` header (or relies on the authenticated user's `country_id`).

**API scoping:** a `resolveCountry` middleware sets `req.country` (from header or user); product/store/category/deals services filter by `country_id`.

**Out of scope (YAGNI):** per-branch/per-city differentiation of the same chain. A `Store` represents a chain within a country for now.

---

## 6. Reliability

**Delivery semantics:** **at-least-once + idempotent writes = effective exactly-once.** True DB-level exactly-once is costly/fragile; idempotent handlers make re-processing safe. Offsets are committed **after** successful processing (process-then-commit).

**Idempotency:**
- Producer: `enable.idempotence=true` (no duplicate produces on retry).
- Persister: `upsert` keyed by unique `(store_id, store_sku)` / `(store_id, product_id)` → reprocessing is overwrite/no-op. Price-history is written **only on price change** → replays do not bloat the table.
- Each event carries `eventId` + `scrapedAt` for traceability/dedup.

**Dead-letter topics:** poison messages (schema violation, or transform still failing after N retries) are produced to `<topic>.dlq` with headers (`error`, `stack`, original `partition`/`offset`, `retryCount`). This prevents **head-of-line blocking** — a single bad message never stalls a country's partition forever. A small admin view supports manual replay from DLQ.

**Retries:** transient errors (LLM 429/timeout, DB deadlock) → bounded in-consumer exponential backoff. Permanent errors (bad data) → straight to DLQ.

**Replay (headline capability):** to reprocess with improved matching, reset the `cheep-matcher` consumer-group offset on `normalized.products.v1` (to-earliest or to a timestamp). Idempotent persistence means **no data duplication**. The catalog is re-matched without re-scraping.

**Schema evolution:** Schema Registry **BACKWARD** compatibility; new fields optional/defaulted; breaking change → `.v2` topic + migration window. Avro reader/writer schema resolution handles version skew.

**Consumer groups:** one group per stage (`cheep-normalizer`, `cheep-matcher`, `cheep-persister`, `cheep-alerter`); scale by adding instances (parallelism capped by partition count).

---

## 7. Infrastructure & Local Dev

- Single `docker-compose.kafka.yml`: **Redpanda broker** (Kafka API compatible) + **Schema Registry** (built into Redpanda) + **Redpanda Console** (inspect topics/messages/consumer groups/DLQ).
- Redpanda chosen for dev ergonomics (single binary, fast startup, Kafka-API compatible → still "Kafka" on the resume). Production may use any Kafka-compatible broker (MSK, Confluent, Redpanda Cloud).
- **Env:** `KAFKA_BROKERS`, `SCHEMA_REGISTRY_URL`, per-consumer `GROUP_ID`; SASL credentials in production.
- Consumers run as separate processes (`npm run consume:<name>`); in production as separate containers, scaled independently.

---

## 8. Testing

- **Unit:** Avro (de)serialization round-trip; each consumer's transform handler tested broker-free by invoking it with a decoded message (same pattern as the existing `similarity` tests).
- **Integration:** **Testcontainers (Redpanda)** in CI — produce a `raw` event, assert it lands in Postgres (end-to-end) and per stage. Redpanda starts fast, suitable for CI.
- **Contract:** schema-registry compatibility check in CI — an incompatible schema change fails the build.
- Existing vitest suite remains; a Kafka integration suite runs as a separate CI job (requires Docker).

---

## 9. Phased Rollout (each phase ships & is testable)

| Phase | Scope |
|-------|-------|
| **0** | `docker-compose.kafka.yml` (Redpanda + Console + Registry), Avro schemas, shared `src/kafka/` client factory. No behavior change. |
| **1** | Scraper produces to `raw.products.v1` + a single all-in-one consumer wrapping existing `import-with-llm` logic (normalize+match+persist). Proves the loop end-to-end with minimal moving parts. |
| **2** | Split the all-in-one consumer into `normalizer` / `matcher` / `persister` + intermediate topics; add DLQ & retries. |
| **3** | `price.events.v1` + `alerter` (push drop-alerts) + Country model & API scoping. |

Throughout, the HTTP `bulk-upsert` path is retained as a fallback/manual ingestion route and for tests.

---

## 10. Avro Schemas (initial)

`raw.products.v1` (illustrative):
```json
{
  "type": "record",
  "name": "RawProduct",
  "namespace": "cheep.ingest",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "countryCode", "type": "string" },
    { "name": "storeId", "type": "int" },
    { "name": "storeSku", "type": "string" },
    { "name": "name", "type": "string" },
    { "name": "brand", "type": ["null", "string"], "default": null },
    { "name": "price", "type": "string" },
    { "name": "unit", "type": ["null", "string"], "default": null },
    { "name": "rawCategory", "type": ["null", "string"], "default": null },
    { "name": "imageUrl", "type": ["null", "string"], "default": null },
    { "name": "scrapedAt", "type": "string" }
  ]
}
```
`normalized.products.v1` adds `normalizedName`, `normalizedBrand`, `size`, `categoryId`.
`matched.products.v1` adds `productId`, `muadilGrupId`, `confidence`.
`price.events.v1`: `productId`, `storeId`, `countryCode`, `oldPrice` (nullable), `newPrice`, `changedAt`.

---

## 11. Out of Scope / YAGNI

- Kafka Streams / ksqlDB stream processing (Approach C) — over-engineering at this data rate.
- Per-branch/per-city store differentiation.
- Real-time (sub-minute) price propagation — not needed (weekly price changes).
- Exactly-once transactional Kafka↔Postgres — replaced by idempotent upserts.
