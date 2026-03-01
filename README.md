# 🐦 Cheep - Akıllı Alışveriş Asistanı

Market fiyatlarını karşılaştıran, en uygun alışveriş rotasını öneren full-stack uygulama.

## 📦 Proje Yapısı

| Modül | Teknoloji | Açıklama |
|-------|-----------|----------|
| **Cheep-Scraper** | Python, LLM | Market fiyat toplama, ürün eşleştirme |
| **cheep-backend-express** | Node.js, Express, Prisma, PostgreSQL | REST API, auth, karşılaştırma motoru |
| **Cheep-Mobile** | React Native, Expo | Mobil uygulama |

## 🚀 Hızlı Başlangıç

### Backend
```bash
cd cheep-backend-express
cp .env.example .env  # DATABASE_URL, JWT_SECRET ayarla
pnpm install
npx prisma migrate dev
pnpm run seed
pnpm dev
```

### Scraper
```bash
cd Cheep-Scraper
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env  # OPENAI_API_KEY veya OPENROUTER_API_KEY
```

### Mobile
```bash
cd Cheep-Mobile
npm install
npx expo start
```

## 📋 Özellikler

- **Fiyat Karşılaştırma** - Migros, CarrefourSA, A101, ŞOK
- **LLM Ürün Eşleştirme** - OpenAI / OpenRouter ile akıllı eşleştirme
- **Rota Optimizasyonu** - TSP algoritması ile en uygun market sırası
- **Alışveriş Listesi** - Bütçe takibi, şablonlar
- **JWT Auth** - Güvenli kullanıcı yönetimi

## 📄 Lisans

MIT
