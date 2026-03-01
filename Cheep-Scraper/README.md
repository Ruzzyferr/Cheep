# 🕷️ Cheep Scraper - Market Price Scraping & Matching System

Ülke bazlı, scalable market fiyat toplama ve ürün eşleştirme sistemi.

## 📋 Özellikler

### ✅ Çoklu Market Desteği
- **Türkiye**: Migros, CarrefourSA, A101, BİM
- **Polonya**: (Hazırlık aşamasında)
- Yeni market eklemek için sadece config dosyasını güncelle

### ✅ Scalable 3-Stage Pipeline
- **Stage 1**: Market-level normalization (LLM ile batch processing)
- **Stage 2**: Cross-market matching (Embedding + Cosine similarity)
- **Stage 3**: Category consolidation

### ✅ Ülke Bazlı Yapı
- Her ülke kendi klasöründe
- Config tabanlı market yönetimi
- Kod değişikliği gerektirmeden yeni market ekleme

## 🚀 Hızlı Başlangıç

### 1. Kurulum

```bash
# Virtual environment oluştur
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# Bağımlılıkları yükle
pip install -r requirements.txt
```

### 2. Environment Variables (.env dosyası)

`.env` dosyasını proje root'unda (`Cheep-Scraper/.env`) oluşturun:

```bash
# .env.example dosyasını kopyala
cp .env.example .env

# .env dosyasını düzenle
```

**.env dosyası içeriği:**

```env
# OpenRouter kullanmak için (önerilen)
OPENROUTER_API_KEY=your-openrouter-key-here
USE_OPENROUTER=true
LLM_MODEL=openai/gpt-4o-mini

# VEYA OpenAI kullanmak için
OPENAI_API_KEY=sk-your-openai-key-here
LLM_MODEL=gpt-4o-mini

# Opsiyonel
AUTO_CREATE_SUBCATEGORIES=false
```

**.env dosyası konumu:**
- `Cheep-Scraper/.env` (proje root'u)

### 3. Market Scraping

```bash
# Türkiye marketlerini scrape et
cd countries/turkey
python run_scrapers.py
```

### 4. Product Matching

```bash
# Scraped ürünleri match et
python run_matcher.py
```

## 📁 Proje Yapısı

```
Cheep-Scraper/
├── README.md                       # Bu dosya
├── requirements.txt                # Python bağımlılıkları
├── scalable-llm-matcher.py        # 3-stage matching pipeline
├── scalable-llm-import.py         # CLI wrapper (eski)
│
├── countries/                      # Ülke bazlı yapı
│   ├── README.md                  # Ülke yapısı dokümantasyonu
│   ├── turkey/
│   │   ├── config.json            # Türkiye marketleri config
│   │   ├── run_scrapers.py        # Scraper runner
│   │   ├── run_matcher.py         # Matcher runner
│   │   ├── output/                # Scraped JSON'lar
│   │   └── logs/                  # Log dosyaları
│   └── poland/
│       └── config.json.example    # Polonya örnek config
│
├── migros/                        # Migros scraper
│   └── migros_api_scraper.py
│
├── carrefour/                     # CarrefourSA scraper
│   └── carrefoursa_api_scraper.py
│
└── util/                          # Utility fonksiyonları
    └── category_mapping.py        # Kategori normalizasyonu
```

## 🎯 Kullanım - Adım Adım

### 📋 Ön Hazırlık

```bash
# 1. Virtual environment'ı aktive et (eğer yoksa oluştur)
cd Cheep-Scraper
python -m venv venv
venv\Scripts\activate  # Windows
# veya: source venv/bin/activate  # Linux/Mac

# 2. Bağımlılıkları yükle
pip install -r requirements.txt

# 3. OpenAI API Key ayarla
# Windows PowerShell:
$env:OPENAI_API_KEY="your-api-key-here"

# Windows CMD:
set OPENAI_API_KEY=your-api-key-here

# Linux/Mac:
export OPENAI_API_KEY="your-api-key-here"
```

### 🚀 Adım 1: Marketleri Scrape Et

```bash
# Türkiye klasörüne git
cd countries/turkey

# Tüm enabled marketleri scrape et
python run_scrapers.py
```

**Ne yapar:**
- `config.json`'daki tüm `enabled: true` marketleri otomatik bulur
- Her market için scraper'ı çalıştırır
- JSON dosyalarını `output/` klasörüne kaydeder

**Çıktı:**
```
countries/turkey/output/
├── migros_products_20250108_143022.json
├── carrefoursa_products_20250108_143055.json
└── scraping_summary_20250108_143100.json
```

### 🔄 Adım 2: Scraped Ürünleri Match Et

```bash
# Aynı klasörde (countries/turkey/)
python run_matcher.py
```

**Ne yapar:**
- `output/` klasöründeki en son JSON dosyalarını bulur
- Scalable 3-stage pipeline ile ürünleri match eder:
  - **Stage 1**: Her market için normalize et
  - **Stage 2**: Cross-market matching (embedding + LLM)
  - **Stage 3**: Kategori consolidation
- Eşleştirilmiş ürünleri `output/` klasörüne kaydeder

**Çıktı:**
```
countries/turkey/output/
└── matched_products_20250108_143200.json
```

### 📤 Adım 3: Backend'e Gönder

Matched products dosyasını backend API'ye göndermek için:

```bash
# Aynı klasörde (countries/turkey/)
python import_to_backend.py

# Veya belirli bir dosya ile:
python import_to_backend.py --file output/matched_products_20251209_135246.json

# Backend URL'ini değiştirmek için:
python import_to_backend.py --api-url http://localhost:3000/api/v1
```

**Script otomatik olarak:**
- En son matched products dosyasını bulur
- Backend API formatına çevirir
- 900'lük parçalar halinde gönderir (backend limiti 1000)
- İstatistikleri gösterir

**Çıktı:**
```
🚀 Matched Products Import başlatılıyor...
📡 Backend API: http://localhost:3000/api/v1
📂 Dosya yükleniyor: matched_products_20251209_135246.json
📦 12302 ürün yüklendi
✅ 12302 ürün API formatına çevrildi
📤 900 boyutlu parçalar halinde gönderiliyor...
--- Parça 1/14 (900 ürün)... ---
✅ Parça 1/14 tamamlandı
   Başarılı: 900, Hatalı: 0
...
```

## 🔧 Örnek Kullanım Senaryosu

### Senaryo: Migros ve CarrefourSA'yı Scrape Et ve Match Et

```bash
# 1. Klasöre git
cd Cheep-Scraper/countries/turkey

# 2. Config'i kontrol et (sadece Migros ve CarrefourSA enabled olmalı)
# config.json dosyasında:
# - Migros: enabled: true
# - CarrefourSA: enabled: true
# - A101: enabled: false
# - BİM: enabled: false

# 3. Scrape et
python run_scrapers.py

# Çıktı göreceksin:
# 🇹🇷 Turkey Scraper Runner başlatıldı
# 🏪 Migros: 150 ürün scrape edildi
# 🏪 CarrefourSA: 200 ürün scrape edildi

# 4. Match et
python run_matcher.py

# Çıktı göreceksin:
# 📦 Toplam 350 ürün bulundu
# 🚀 Scalable 3-Stage Pipeline başlatılıyor...
# [Stage 1] Market-Level Normalization...
# [Stage 2] Cross-Market Matching...
# [Stage 3] Category Consolidation...
# ✅ Matching tamamlandı!
# 📤 Çıktı: 320 unique ürün
```

### Sadece Bir Market Test Etmek İçin

```bash
# config.json'da sadece bir market'i enabled yap
# Örneğin sadece Migros:
{
  "markets": [
    {
      "name": "Migros",
      "enabled": true
    },
    {
      "name": "CarrefourSA",
      "enabled": false  # Geçici olarak kapat
    }
  ]
}

# Sonra normal akış:
python run_scrapers.py
python run_matcher.py
```

### Sadece Belirli Marketleri Scrape Et

`countries/turkey/config.json` dosyasında market'in `enabled` değerini `false` yapın:

```json
{
  "name": "A101",
  "enabled": false
}
```

## ⚙️ Yeni Market Ekleme

### 1. Scraper'ı Oluştur

```python
# migros/migros_api_scraper.py gibi
class YeniMarketScraper:
    def fetch_products(self):
        # Scraping logic
        return [Product(...), ...]
```

### 2. Config'e Ekle

`countries/turkey/config.json` dosyasına ekleyin:

```json
{
  "name": "YeniMarket",
  "store_id": 5,
  "scraper_path": "../../yeni_market/scraper.py",
  "scraper_class": "YeniMarketScraper",
  "scraper_method": "fetch_products",
  "output_pattern": "yenimarket_products_{timestamp}.json",
  "enabled": true
}
```

### 3. Çalıştır

```bash
python run_scrapers.py
```

**Kod değişikliği gerektirmez!** Script'ler otomatik olarak yeni marketi bulur.

## 🌍 Yeni Ülke Ekleme

Detaylar için `countries/README.md` dosyasına bakın.

## 🔄 3-Stage Matching Pipeline

### Stage 1: Market-Level Normalization
- Her market kendi ürünlerini normalize eder
- LLM ile batch processing (300 ürün/batch)
- Kategori atama

### Stage 2: Cross-Market Matching
- Embedding oluşturma (text-embedding-3-small)
- Cosine similarity ile benzerlik bulma
- LLM ile belirsiz grupları doğrulama

### Stage 3: Category Consolidation
- Çakışan kategorileri düzelt
- Yeni kategori önerilerini topla

**Maliyet (16K ürün örneği):**
- Stage 1: ~$8 (LLM normalization)
- Stage 2: ~$0.02 (Embedding - çok ucuz!)
- Stage 3: ~$0.15 (LLM verification)
- **TOPLAM: ~$8.17**

## 📊 Output Format

### Scraping Output

```json
[
  {
    "name": "Sütaş Tam Yağlı Süt",
    "brand": "Sütaş",
    "price": 25.90,
    "category": "Süt Ürünleri",
    "unit": "adet",
    "sku": "MIG-123",
    ...
  }
]
```

### Matching Output

```json
{
  "timestamp": "2025-01-08T14:30:00",
  "country": "Turkey",
  "input": {
    "total_products": 1000,
    "markets": ["Migros", "CarrefourSA"]
  },
  "output": {
    "unique_products": 850,
    "total_price_entries": 1000
  },
  "products": [...]
}
```

## 🐛 Troubleshooting

### "JSON dosyası bulunamadı"
**Çözüm:** Önce `run_scrapers.py` çalıştırın.

### "Scraper class bulunamadı"
**Kontrol edin:** `config.json`'daki `scraper_class` adı ile scraper dosyasındaki class adı eşleşmeli.

### API Rate Limit
`scalable-llm-matcher.py` içindeki delay'leri artırın.

## 📚 Dokümantasyon

- **countries/README.md** - Ülke bazlı yapı detayları
- **scalable-llm-matcher.py** - Pipeline implementasyonu (kod içi dokümantasyon)

## ⚠️ Yasal Uyarı

Bu scraper yalnızca eğitim amaçlıdır. Kullanmadan önce:
1. İlgili web sitelerinin `robots.txt` dosyasını kontrol edin
2. Kullanım şartlarını okuyun
3. Rate limiting kullanarak sunucuları yormayın
4. Ticari kullanım için izin alın
