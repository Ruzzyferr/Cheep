# Kafka Event-Driven Ingestion Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn Cheep's ingestion into a country-partitioned Kafka pipeline (scraper produces → normalize → match → persist → price events), per `docs/superpowers/specs/2026-06-04-kafka-event-pipeline-design.md`.

**Architecture:** Redpanda (Kafka API) + Schema Registry (Avro). Node consumers (`kafkajs` + `@kafkajs/confluent-schema-registry`) wrap existing services. Python scraper produces with `confluent-kafka`. Country becomes first-class (Prisma `Country`, `country_id` on Store/Product/User), location→country via expo-location reverseGeocode.

**Tech Stack:** Redpanda, kafkajs, @kafkajs/confluent-schema-registry, avsc, Prisma/Postgres, confluent-kafka (py), expo-location.

**Verification:** backend `npx tsc --noEmit` + `pnpm test`; mobile `npx tsc --noEmit`; scraper `python -m py_compile`. Runtime (broker/DB) verification is out-of-environment and noted where applicable.

---

## Phase 0 — Infra & Kafka scaffolding

### Task 0.1: Redpanda docker-compose
- Create: `docker-compose.kafka.yml` (Redpanda broker, schema registry, Redpanda Console).
- [ ] Write compose with redpanda + console services, ports 9092 (kafka), 8081 (schema registry), 8080 (console).
- [ ] Commit.

### Task 0.2: Kafka deps + shared client factory
- Modify: `cheep-backend-express/package.json` (add kafkajs, @kafkajs/confluent-schema-registry, uuid + types).
- Create: `src/kafka/topics.ts` (topic name constants + consumer group ids).
- Create: `src/kafka/client.ts` (Kafka instance from `KAFKA_BROKERS`).
- Create: `src/kafka/schema-registry.ts` (SchemaRegistry from `SCHEMA_REGISTRY_URL`, register/encode/decode helpers).
- Create: `src/kafka/avro/*.avsc.json` (raw, normalized, matched, price-event schemas).
- [ ] Implement, `npx tsc --noEmit`, commit.

### Task 0.3: Producer & consumer helpers + DLQ/retry
- Create: `src/kafka/producer.ts` (idempotent producer, `publish(topic, key, value)` Avro-encoded).
- Create: `src/kafka/consumer.ts` (`runConsumer({groupId, topic, schema, handler, batchSize})` with process-then-commit, bounded retry, DLQ on exhaustion).
- [ ] Implement, typecheck, commit.

## Phase 1 — Producer + all-in-one consumer

### Task 1.1: Extract ingest core service
- Create: `src/services/ingest.service.ts` — `processRawProducts(records)` containing the normalize+match+persist logic currently inline in `store-prices-llm.controller.ts`, callable by both the HTTP controller and the consumer.
- Modify: `store-prices-llm.controller.ts` to call the service.
- [ ] Typecheck, commit.

### Task 1.2: All-in-one consumer entrypoint
- Create: `src/consumers/ingest.ts` — consumes `raw.products.v1`, batches, calls `processRawProducts`, emits `price.events`.
- Modify: `package.json` scripts: `consume:ingest`.
- [ ] Typecheck, commit.

### Task 1.3: Scraper producer
- Create: `Cheep-Scraper/common/kafka_producer.py` — confluent-kafka Avro producer, `produce_raw(country_code, record)`.
- Modify: `countries/turkey/import_to_backend.py` — optional Kafka path (env `INGEST_MODE=kafka|http`).
- Modify: `requirements.txt` (confluent-kafka, fastavro).
- [ ] `python -m py_compile`, commit.

## Phase 2 — Split consumers + reliability

### Task 2.1: normalizer / matcher / persister consumers
- Create: `src/consumers/normalizer.ts`, `matcher.ts`, `persister.ts` wrapping `category-matcher` / `product-matcher`+`llm-product-matcher` / `store-prices.service`.
- Modify: `package.json` scripts.
- [ ] Typecheck, commit.

## Phase 3 — Country multi-tenancy

### Task 3.1: Prisma Country model + country_id
- Modify: `prisma/schema.prisma` (Country model; country_id on Store/Product/User).
- Create: migration `20260604140000_add_country` (+ backfill existing rows to TR).
- [ ] `prisma generate`, `tsc --noEmit`, commit.

### Task 3.2: API country scoping
- Create: `src/middleware/country.middleware.ts` (`resolveCountry` → req.country from `x-country` header or user).
- Modify: product/store/category services to filter by country.
- [ ] Typecheck, commit.

### Task 3.3: Mobile location→country
- Modify: `src/utils/geo.ts` (add `getCountryCode` via `reverseGeocodeAsync`).
- Modify: `src/services/api.client.ts` (send `x-country` header from stored country).
- Modify: `src/utils/storage.ts` (country storage).
- [ ] `tsc --noEmit`, commit.

---

## Self-Review
- Spec coverage: topics/partitioning (0.2), producer+consumers (0.3,1.x,2.1), country model (3.x), reliability DLQ/retry (0.3), infra (0.1), schemas (0.2). Covered.
- Runtime (broker/DB) verification is out-of-environment; all code is typecheck-verified.
