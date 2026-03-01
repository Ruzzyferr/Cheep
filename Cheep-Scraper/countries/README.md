# 🌍 Country-Based Architecture

Ülke bazlı scraper ve matcher yapısı. Her ülke kendi klasöründe, config tabanlı yönetim.

## 📁 Klasör Yapısı

```
countries/
├── README.md                    # Bu dosya
├── turkey/
│   ├── config.json              # Türkiye marketleri config
│   ├── run_scrapers.py          # Türkiye scraper runner
│   ├── run_matcher.py           # Türkiye matcher runner
│   ├── output/                  # Scraped JSON'lar
│   └── logs/                    # Log dosyaları
└── poland/
    ├── config.json              # Polonya marketleri config
    ├── run_scrapers.py          # Polonya scraper runner
    ├── run_matcher.py           # Polonya matcher runner
    ├── output/
    └── logs/
```

## 🎯 Özellikler

### ✅ Yeni Market Eklemek Çok Kolay

1. Scraper'ı oluştur
2. `config.json`'a ekle
3. **Kod değişikliği gerektirmez!**

### ✅ Ülke Bağımsız

- Her ülke kendi klasöründe
- Farklı scraper'lar, farklı formatlar
- Kolayca yeni ülke eklenebilir

### ✅ Otomatik Discovery

- Script'ler config'ten marketleri otomatik bulur
- Enabled/disabled market yönetimi
- En son scraped dosyaları otomatik bulur

## 🚀 Yeni Ülke Eklemek

### 1. Klasör Yapısını Oluştur

```bash
mkdir -p countries/poland
cd countries/poland
```

### 2. Script'leri Kopyala

```bash
cp ../turkey/run_scrapers.py .
cp ../turkey/run_matcher.py .
```

### 3. Config Dosyasını Oluştur

`config.json` dosyasını oluştur ve marketleri ekle:

```json
{
  "country": "Poland",
  "country_code": "PL",
  "markets": [
    {
      "name": "CarrefourPL",
      "store_id": 10,
      "scraper_path": "scrapers/carrefour_pl/scraper.py",
      "scraper_class": "CarrefourPLScraper",
      "scraper_method": "fetch_products",
      "output_pattern": "carrefour_pl_products_{timestamp}.json",
      "enabled": true
    }
  ],
  "output_dir": "output",
  "log_dir": "logs"
}
```

### 4. Çalıştır!

```bash
python run_scrapers.py  # Tüm marketleri scrape et
python run_matcher.py   # Match et
```

## 📋 Market Scraper Gereksinimleri

Scraper class'ınız şu özelliklere sahip olmalı:

1. **Class adı**: Config'teki `scraper_class` ile eşleşmeli
2. **Method**: Config'teki `scraper_method` olmalı
3. **Return**: List of Product objects veya dict listesi
4. **Product format**: `to_dict()` method'u varsa kullanılır, yoksa dict beklenir

### Örnek Scraper

```python
from dataclasses import dataclass, asdict

@dataclass
class Product:
    name: str
    brand: Optional[str]
    price: float
    # ...

    def to_dict(self):
        return asdict(self)

class MyMarketScraper:
    def fetch_products(self):
        # Scraping logic
        return [Product(...), ...]
```

## 🔄 Workflow

### Normal Kullanım

```bash
# 1. Tüm marketleri scrape et
cd countries/turkey
python run_scrapers.py

# 2. Scraped ürünleri match et
python run_matcher.py
```

### Sadece Bir Market

1. `config.json`'da diğer marketlerin `enabled` değerini `false` yap
2. `run_scrapers.py` çalıştır

### Yeni Market Ekleme

1. Scraper'ı oluştur
2. `config.json`'a ekle (`enabled: true`)
3. `run_scrapers.py` çalıştır
4. Otomatik olarak çalışır!

## 📊 Output Format

### Scraping Output

Her market için:
```json
[
  {
    "name": "Ürün Adı",
    "brand": "Marka",
    "price": 25.90,
    "category": "Süt Ürünleri",
    ...
  }
]
```

### Matching Output

Matched products:
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

## 🔧 Özelleştirme

### Scraper Path'leri

- **Relative**: `scrapers/migros/scraper.py` (country_dir'den)
- **Absolute**: `/full/path/to/scraper.py`
- **Parent relative**: `../../migros/scraper.py` (country_dir'den yukarı)

### Output Pattern

`{timestamp}` placeholder'ı otomatik olarak değiştirilir:
- `migros_products_{timestamp}.json` → `migros_products_20250108_143022.json`

## 🐛 Troubleshooting

### "Config dosyası bulunamadı"

Script'i `countries/[country]/` klasöründe çalıştırın.

### "Scraper bulunamadı"

`config.json`'daki `scraper_path`'i kontrol edin. Relative path ise country_dir'den başlar.

### "Class/Method bulunamadı"

Scraper dosyasındaki class ve method adlarını `config.json` ile eşleştirin.

