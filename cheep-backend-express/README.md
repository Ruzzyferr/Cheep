# 🛒 Cheep Backend — Akıllı Alışveriş Asistanı API

Express 5 + TypeScript (ESM) + Prisma + PostgreSQL ile geliştirilmiş RESTful API. Event-driven ingestion için Kafka (KafkaJS) consumer'ları ve çok-ülke desteği içerir.

## 📋 Modüller

- **Auth** — JWT **access (1s) + refresh (30g)** token; `/auth/refresh` ile sessiz yenileme
- **Products** — CRUD, arama, fiyat karşılaştırma, fuzzy matching, **fiyat geçmişi** (`/:id/history`)
- **Stores / Categories / Lists** — yönetim, hiyerarşik kategoriler, şablonlar, istatistikler
- **Store Prices** — fiyat upsert, toplu import, **LLM import** (API-key korumalı ingestion)
- **Compare Engine** — 7-faktör skorlama, TSP rota optimizasyonu (sınırlı kombinatorik)
- **Feedback** — kullanıcı fiyat doğruluk geri bildirimleri (is_accurate / suggested_price)
- **Country multi-tenancy** — ülke-bazlı ürün/mağaza scoping (`x-country` header)
- **Kafka consumers** — normalizer / matcher / persister / ingest (bkz. kök `docker-compose.kafka.yml`)

## 🚀 Kurulum

```bash
# 1. Bağımlılıklar
pnpm install

# 2. Ortam değişkenleri
cp .env.example .env   # DATABASE_URL, JWT_SECRET (≥32), ALLOWED_ORIGINS, INGEST_API_KEY, LLM anahtarları

# 3. Migration'lar (feedback boolean modeli + price_history + country dahil) ve client
pnpm db:migrate:deploy
pnpm db:generate

# 4. Seed (TR/PL ülkeleri + demo veri)
pnpm db:seed

# 5. Sunucu
pnpm dev               # http://localhost:3000
```

> ⚠️ Bu sürüm 3 yeni migration getirir: `feedback_boolean_model`, `add_price_history`, `add_country`. Mevcut bir DB'de mutlaka `pnpm db:migrate:deploy` çalıştırın (country_id mevcut veriye `TR` olarak backfill edilir).

## 🔑 Öne Çıkan Endpoint'ler

```
POST /api/v1/auth/register | login | refresh
GET  /api/v1/products            (x-country ile ülkeye göre filtrelenir)
GET  /api/v1/products/:id/history?days=90     # fiyat geçmişi (zaman serisi)
GET  /api/v1/products/:id/compare
GET  /api/v1/stores              (x-country ile filtrelenir)
POST /api/v1/store-prices/upsert | bulk-upsert | import-with-llm   # x-api-key (INGEST_API_KEY) gerekir
POST /api/v1/lists/:id/compare   # rota optimizasyonu (sahibe özel)
POST /api/v1/feedback
```

Tam dokümantasyon: **Swagger UI** → `http://localhost:3000/api-docs`

## 🔐 Güvenlik

- **Auth:** access + refresh token; tüm korumalı route'larda `authenticate`; sahiplik (IDOR) kontrolleri
- **Ingestion:** ürün/fiyat yazma endpoint'leri `x-api-key` (`INGEST_API_KEY`) ile korunur — scraper bunu gönderir
- **CORS:** `ALLOWED_ORIGINS` allowlist; **rate limiting** her ortamda aktif
- Hata yanıtlarında stack/detay sızdırılmaz; graceful shutdown (SIGTERM/SIGINT)

## 🗄️ Veritabanı (Prisma)

Ana tablolar: `countries`, `users`, `stores` (lat/lon/city/country_id), `categories` (hiyerarşik), `products` (country_id, muadil_grup_id), `store_prices`, `price_history`, `lists`, `list_items`, `price_feedbacks`, `user_favorite_stores`.

```
Country → Store / Product (1:N)     Store/Product → PriceHistory (1:N)
User → List (1:N)                   Product ↔ StorePrice (1:N)
List → ListItem (1:N)               Product → Category (N:1)
```

## 📡 Event-Driven Ingestion (Kafka)

```
raw.products → [normalizer] → normalized.products → [matcher] → matched.products → [persister] → Postgres
                                                                                         └→ price.events
```

```bash
# Kök dizinde Redpanda'yı başlat
docker compose -f docker-compose.kafka.yml up -d        # Console: http://localhost:8080
# Backend env: KAFKA_BROKERS=localhost:9092  SCHEMA_REGISTRY_URL=http://localhost:8081
pnpm consume:normalizer   # consume:matcher | consume:persister | consume:ingest
```

Avro şemaları `src/kafka/avro/`, paylaşılan client/producer/consumer `src/kafka/`. Consumer'lar process-then-commit + bounded retry + dead-letter topic kullanır; ülke koduyla partition'lanır.

## 🧪 Test & CI

```bash
pnpm test            # vitest (fuzzy-matching çekirdeği: utils/similarity.ts)
pnpm typecheck       # tsc --noEmit
```
GitHub Actions (`.github/workflows/ci.yml`): backend (generate+typecheck+test), mobil (typecheck), scraper (py compile).

## 📝 Ortam Değişkenleri

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://user:pass@localhost:5432/cheep?schema=public"
JWT_SECRET="en-az-32-karakterlik-gizli-deger"
ALLOWED_ORIGINS="http://localhost:8081,https://app.cheep.com"
INGEST_API_KEY="scraper-icin-paylasilan-anahtar"
DEFAULT_COUNTRY_CODE=TR
# LLM (opsiyonel)
USE_OPENROUTER=false
OPENAI_API_KEY="sk-..."
OPENROUTER_API_KEY="sk-or-..."
LLM_MODEL="gpt-4o-mini"
# Kafka (opsiyonel - event pipeline)
KAFKA_BROKERS=localhost:9092
SCHEMA_REGISTRY_URL=http://localhost:8081
```

## 🚦 Scripts

```bash
pnpm dev              # hot reload (tsx)
pnpm build            # tsc → dist
pnpm start            # production
pnpm db:migrate:deploy / db:migrate:dev / db:generate / db:studio / db:seed
pnpm test / typecheck / lint
pnpm consume:ingest | consume:normalizer | consume:matcher | consume:persister
```

## 📁 Proje Yapısı

```
src/
├── api/            # auth, products, stores, categories, lists, users, store-prices, feedback
├── consumers/      # ingest, normalizer, matcher, persister (Kafka)
├── kafka/          # client, producer, consumer, schema-registry, avro/
├── config/         # config (env doğrulama: JWT, ingest key, CORS)
├── middleware/     # auth, ingest-auth, country, rate-limit, error, sanitize
├── services/       # compare-engine, route-optimizer, llm-product-matcher, ingest
├── utils/          # prisma, logger, similarity, country
└── types/
prisma/             # schema.prisma, migrations/, seed.ts
```

## 🔐 Test Kullanıcısı

`test@cheep.com` / `test123456`
