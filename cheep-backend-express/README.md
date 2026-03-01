# 🛒 Cheep Backend - Akıllı Alışveriş Asistanı API

Express.js + TypeScript + Prisma + PostgreSQL ile geliştirilmiş RESTful API.

## 📋 Özellikler

### ✅ Tamamlanan Modüller (85%)

- **Authentication & Authorization** - JWT tabanlı kimlik doğrulama
- **Products API** - Ürün CRUD, arama, fiyat karşılaştırma, fuzzy matching
- **Stores API** - Market yönetimi
- **Store Prices API** - Dinamik fiyat yönetimi, bulk import
- **Categories API** - Kategori yönetimi, hiyerarşik yapı
- **Lists API** - Alışveriş listesi CRUD, şablonlar, istatistikler
- **Compare Engine** - 7-factor scoring, rota optimizasyonu, TSP algoritması
- **Feedback System** - Kullanıcı fiyat geri bildirimleri
- **LLM Product Matcher** - OpenAI/OpenRouter ile ürün eşleştirme

## 🚀 Kurulum

### Gereksinimler
- Node.js (v18+)
- PostgreSQL (v14+)
- npm veya pnpm

### Adımlar

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Environment variables
cp .env.example .env
# .env dosyasını düzenle:
# - DATABASE_URL
# - JWT_SECRET (min 32 karakter)
# - OPENAI_API_KEY (opsiyonel, LLM matching için)

# 3. Veritabanını oluştur
npx prisma migrate dev

# 4. Prisma Client oluştur
npx prisma generate

# 5. Seed verileri (opsiyonel)
npx tsx prisma/seed.ts

# 6. Sunucuyu başlat
npm run dev
```

Sunucu `http://localhost:3000` adresinde çalışacak.

## 📚 API Dokümantasyonu

### Swagger UI
```
http://localhost:3000/api-docs
```

### Base URL
```
http://localhost:3000/api/v1
```

## 🔑 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Yeni kullanıcı kaydı
- `POST /api/v1/auth/login` - Kullanıcı girişi

### Products
- `GET /api/v1/products` - Ürün listeleme (filter, search, pagination)
- `GET /api/v1/products/:id` - Ürün detayı
- `GET /api/v1/products/barcode/:barcode` - Barkod ile ürün bulma
- `POST /api/v1/products` - Yeni ürün oluşturma
- `PUT /api/v1/products/:id` - Ürün güncelleme
- `DELETE /api/v1/products/:id` - Ürün silme
- `GET /api/v1/products/:id/prices` - Ürün fiyatları
- `GET /api/v1/products/:id/compare` - Fiyat karşılaştırma

### Stores
- `GET /api/v1/stores` - Market listesi
- `GET /api/v1/stores/:id` - Market detayı
- `POST /api/v1/stores` - Yeni market ekleme
- `PUT /api/v1/stores/:id` - Market güncelleme
- `DELETE /api/v1/stores/:id` - Market silme

### Store Prices
- `POST /api/v1/store-prices` - Fiyat kaydetme/güncelleme
- `POST /api/v1/store-prices/bulk` - Toplu fiyat import (max 1000)
- `POST /api/v1/store-prices/import-with-llm` - LLM ile ürün eşleştirme ve import

### Categories
- `GET /api/v1/categories` - Kategori listesi
- `POST /api/v1/categories` - Yeni kategori oluşturma (smart matching)

### Lists
- `GET /api/v1/lists` - Kullanıcı listeleri (active/completed/templates)
- `GET /api/v1/lists/:id` - Liste detayı
- `POST /api/v1/lists` - Yeni liste oluşturma
- `PUT /api/v1/lists/:id` - Liste güncelleme
- `DELETE /api/v1/lists/:id` - Liste silme
- `GET /api/v1/lists/:id/stats` - Liste istatistikleri
- `POST /api/v1/lists/:id/compare` - Liste karşılaştırma ve rota optimizasyonu
- `POST /api/v1/lists/templates` - Şablon oluşturma

### Users
- `GET /api/v1/users/me` - Kullanıcı profili
- `PUT /api/v1/users/me` - Profil güncelleme
- `GET /api/v1/users/me/favorite-stores` - Favori marketler
- `POST /api/v1/users/me/favorite-stores/:storeId` - Favori market ekle
- `DELETE /api/v1/users/me/favorite-stores/:storeId` - Favori market sil

### Feedback
- `POST /api/v1/feedback` - Fiyat geri bildirimi

## 📊 Veritabanı Yapısı

### Ana Tablolar
- `users` - Kullanıcılar
- `stores` - Marketler (konum bilgisi ile)
- `categories` - Ürün kategorileri (hiyerarşik)
- `products` - Ürünler (muadil_grup_id ile gruplandırılmış)
- `store_prices` - Dinamik fiyatlar
- `lists` - Alışveriş listeleri
- `list_items` - Liste öğeleri
- `price_feedback` - Kullanıcı geri bildirimleri
- `user_favorite_stores` - Favori marketler

### İlişkiler
```
User → Lists (1:N)
User → PriceFeedback (1:N)
Store → StorePrice (1:N)
Product → StorePrice (1:N)
Product → Category (N:1)
List → ListItem (1:N)
```

## 🔍 Önemli Özellikler

### Product Matching
Fuzzy matching algoritması ile benzer ürünleri otomatik eşleştirir:
- Text normalization (Türkçe karakter desteği)
- Levenshtein distance
- Jaccard similarity
- Fingerprint generation
- %95+ doğruluk oranı

### Compare Engine
7-factor scoring algoritması:
1. Total Price (ağırlık: 30%)
2. Store Count (ağırlık: 15%)
3. Distance (ağırlık: 20%)
4. Route Efficiency (ağırlık: 15%)
5. Favorite Store Bonus (ağırlık: 10%)
6. Missing Products Penalty (ağırlık: -10%)
7. Budget Compliance (ağırlık: 10%)

TSP (Traveling Salesman Problem) algoritması ile optimal rota hesaplar.

### LLM Product Matcher
3-stage pipeline:
- **Stage 1**: Market-level normalization (LLM batch processing)
- **Stage 2**: Cross-market matching (Embedding + Cosine similarity)
- **Stage 3**: Category consolidation

### Category Matching
Otomatik kategori eşleştirme:
- Exact match
- Fuzzy match
- Keyword matching (parent bulma)
- Yeni kategori önerileri

## 🔐 Test Credentials

**Test Kullanıcı:**
- Email: `test@cheep.com`
- Şifre: `test123456`

## 🛠️ Teknoloji Yığını

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** JWT + bcrypt
- **Validation:** Joi
- **Documentation:** Swagger UI
- **Logging:** Winston
- **LLM:** OpenAI/OpenRouter

## 📝 Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cheep_db"

# Auth
JWT_SECRET="your-secret-key-min-32-chars"

# Server
PORT=3000
NODE_ENV=development

# LLM (opsiyonel)
OPENAI_API_KEY="your-openai-key"
OPENROUTER_API_KEY="your-openrouter-key"
USE_OPENROUTER=false
LLM_MODEL="gpt-4o-mini"
```

## 🚦 Scripts

```bash
# Development
npm run dev              # Hot reload ile çalıştır
npm run build           # Production build
npm run start           # Production mode

# Database
npx prisma migrate dev  # Yeni migration oluştur
npx prisma generate     # Prisma Client güncelle
npx prisma studio       # Database GUI
npx tsx prisma/seed.ts  # Seed verileri

# Testing
npm run test            # Test çalıştır
npm run lint            # Lint kontrolü
```

## 📁 Proje Yapısı

```
cheep-backend-express/
├── src/
│   ├── api/              # API routes
│   │   ├── auth/
│   │   ├── products/
│   │   ├── stores/
│   │   ├── categories/
│   │   ├── lists/
│   │   ├── users/
│   │   ├── store-prices/
│   │   └── feedback/
│   ├── config/           # Configuration
│   ├── middleware/       # Custom middleware
│   ├── schema/           # Validation schemas
│   ├── services/         # Business logic
│   │   ├── compare-engine.service.ts
│   │   ├── llm-product-matcher.service.ts
│   │   └── route-optimizer.service.ts
│   ├── types/            # TypeScript types
│   └── utils/            # Utilities
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── migrations/       # Migration files
│   └── seed.ts           # Seed script
└── package.json
```

## 🐛 Troubleshooting

### Database Connection Error
```bash
# PostgreSQL'in çalıştığından emin olun
# DATABASE_URL'i kontrol edin
```

### Migration Errors
```bash
# Migration'ı resetle
npx prisma migrate reset
```

### Prisma Client Error
```bash
# Prisma Client'ı yeniden oluştur
npx prisma generate
```

## 📚 Daha Fazla Bilgi

Detaylı API dokümantasyonu için Swagger UI kullanın: `http://localhost:3000/api-docs`
