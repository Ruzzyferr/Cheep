# Türkiye Pazarı Hazırlığı — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cheep'i Türkiye pazarına hazırlamak — 4-6 ulusal zincirden doğru/temiz veri (isim/fiyat/gramaj/kategori), kanonik kategori taksonomisi ve kökten premium mobil UI; hepsi canlı veri + Playwright ile doğrulanmış.

**Architecture:** Python config-driven scraper'lar (API tercih, Playwright fallback) → HTTP/Kafka ingest → Express+Prisma+Postgres → RN/Expo mobil. Deterministik logic'te (unit parser, kategori eşleme) TDD; canlı scraping/UI'da çalıştır-ve-kanıtla kapıları.

**Tech Stack:** Python 3.12 (requests, Playwright, BeautifulSoup), Node 24 / pnpm 10 (Express 5, Prisma, vitest), React Native 0.81 / Expo 54, Postgres (Docker), Playwright/Chromium 141.

## Global Constraints

- ESM backend: import specifier'larda `.js` uzantısı zorunlu (NodeNext).
- Scraping rate-limit korunur (≥ saniyeler arası bekleme); yalnızca açık fiyat verisi.
- Ingest endpoint'leri `x-api-key` (INGEST_API_KEY) ister; country_id zorunlu (default TR).
- "Emin olmadan bitti deme": her faz somut kanıtla kapanır (gerçek veri örneği / yeşil test / ekran görüntüsü).
- Para birimi: Decimal/Number; fiyat > 0; gramaj normalize (kg/g/l/ml/adet/paket/kutu).
- LLM anahtarı yoksa deterministik fuzzy matcher + kural tabanlı kategori eşlemeye düş; raporla.

---

## Faz 0 — Ortam & Temel

### Task 0.1: Postgres + backend baseline
**Files:** Modify: çalışma ortamı (Docker), `cheep-backend-express/.env`
- [ ] Docker daemon hazır olana kadar bekle; Postgres'i compose ile ayağa kaldır (kök `docker-compose.kafka.yml` Kafka içindir — Postgres için ayrı tek-servis compose veya `docker run postgres` kullan, DATABASE_URL ile uyumlu: db=cheep_db, port 5432).
- [ ] `pnpm install` (gerekirse), `pnpm db:migrate:deploy`, `pnpm db:generate`.
- [ ] Baseline yeşil: `pnpm typecheck`, `pnpm test`; mobil `npm run typecheck`.
- **Gate:** `npx prisma migrate status` → "Database schema is up to date"; backend `pnpm dev` ayakta (health check 200).

### Task 0.2: Migros scraper canlı onarım
**Files:** Modify: `Cheep-Scraper/migros/migros_api_scraper.py`, `Cheep-Scraper/util/category_mapping.py`
- [ ] Playwright/curl ile doğru Migros endpoint+slug'larını keşfet (tarayıcı UA; 404 → güncel `/rest/search/screens/{slug}` slug'ları). Header setini gerçekçi yap.
- [ ] Scraper'ı çalıştır, en az 2 kategoriden gerçek ürün çek; isim/fiyat/gramaj/kategori örneklerini doğrula.
- **Gate:** `python run_scrapers.py` (yalnız Migros enabled) → output JSON'da ≥100 ürün, fiyatlar > 0, gramaj alanları dolu.

---

## Faz 1 — Scraper Altyapısı + Yeni Marketler

### Task 1.1: Tek Product modeli + güçlü unit/gramaj parser (TDD)
**Files:** Modify: `Cheep-Scraper/scrapers/base_scraper.py`; Create: `Cheep-Scraper/tests/test_unit_parser.py`
**Interfaces:** Produces: `parse_quantity_and_unit(str) -> (float, str)`, `normalize_unit(str) -> str`, `compute_unit_price(price: Decimal, qty: float, unit: str) -> (Decimal, str)`
- [ ] **Test yaz (fail):** çoklu paket `2x200 g → (400.0,'g')`, ondalık `1,5 L → (1.5,'l')`, `500ml → (500,'ml')`, `1 kg → (1.0,'kg')`, addan çıkarım `"Süt 1 L" → (1.0,'l')`, birim-başı `(₺30, 1.5, 'l') → (₺20.0,'l')`.
- [ ] Run: `pytest tests/test_unit_parser.py -v` → FAIL.
- [ ] Parser'ı güçlendir (regex setleri + `compute_unit_price`). İki `Product` dataclass'ını tek modele indir (`base_scraper.Product` kanonik; `price_per_unit`,`unit_price_unit` alanları ekle).
- [ ] Run: `pytest tests/test_unit_parser.py -v` → PASS.
- [ ] Commit.
- **Gate:** testler yeşil; Migros scraper yeni modele uyarlanmış ve hâlâ çalışıyor.

### Task 1.2: ŞOK scraper (API keşfi → scraper)
**Files:** Create: `Cheep-Scraper/sok/sok_scraper.py`; Modify: `countries/turkey/config.json`, `util/category_mapping.py`
- [ ] Playwright ile sokmarket.com.tr'de bir kategori sayfasını aç, **network isteklerini yakala**, ürün listesi dönen JSON API endpoint'ini bul (URL, params, header, response şekli).
- [ ] API varsa requests-tabanlı scraper (Migros deseni); yoksa Playwright DOM scraper. `Product` modeline map et (isim/marka/fiyat/gramaj/kategori/sku/görsel).
- [ ] config.json'a ŞOK ekle (store_id=5), kategori slug eşlemesi.
- **Gate:** ŞOK'tan ≥100 gerçek ürün; örnekte fiyat/gramaj/kategori doğru.

### Task 1.3: A101 scraper (Playwright + Cloudflare)
**Files:** Create: `Cheep-Scraper/a101/a101_scraper.py`; Modify: `countries/turkey/config.json`, `util/category_mapping.py`
- [ ] Playwright persistent context (browser_data/a101) ile Cloudflare'i geç; kategori sayfalarından ürün çek (API yakalanırsa onu kullan).
- [ ] `Product` modeline map; config.json'a A101 ekle (store_id=3, mevcut stub'ı gerçek path'e çevir).
- **Gate:** A101'den ≥100 gerçek ürün; örnek doğrulama. (Cloudflare bloklarsa: dürüst raporla, alternatif dene.)

### Task 1.4: Macrocenter + Tarım Kredi + diğer feasible (probe-gated)
**Files:** Create: `Cheep-Scraper/macrocenter/...`, gerekirse diğerleri; Modify: `config.json`
- [ ] Macrocenter: Migros API altyapısı reuse denemesi (hızlı probe). Pozitifse ekle.
- [ ] Tarım Kredi + (Getir/File/Hakmar) için hızlı Playwright/curl probe; yalnızca feasible olanları ekle.
- **Gate:** Eklenen her market canlı veri döndürür; eklenemeyenler kısa gerekçeyle raporlanır.

---

## Faz 2 — Veri Kalitesi & Kanonik Kategori Taksonomisi

### Task 2.1: Kanonik taksonomi + kural tabanlı eşleme (TDD)
**Files:** Create: `Cheep-Scraper/util/taxonomy.py`, `tests/test_taxonomy.py`; Modify: `scalable-llm-matcher.py`, `util/category_mapping.py`
**Interfaces:** Produces: `CANONICAL_TAXONOMY` (üst+alt kategori ağacı), `map_to_canonical(raw_name: str, raw_category: str) -> (top: str, sub: str)`
- [ ] **Test yaz (fail):** "Pınar Süt 1L"→(Süt & Kahvaltılık, Süt), "Domates"→(Meyve & Sebze, Sebze), "Yumuşatıcı"→(Temizlik, Çamaşır), "Bebek Bezi"→(Bebek, Bez) vb. ≥15 vaka.
- [ ] Run pytest → FAIL.
- [ ] `taxonomy.py`: kanonik ağaç + anahtar-kelime/regex kural tablosu + `map_to_canonical`. Matcher pipeline'ına bağla (LLM normalizer doğrulaması opsiyonel).
- [ ] Run pytest → PASS. Commit.
- **Gate:** testler yeşil; gerçek scrape veri üzerinde "Diğer/boş kategori" oranı < %5; N=100 örnekte doğru-kategori ≥ %90 (rapor).

### Task 2.2: Şema/veri temizliği (gereksiz veri yok)
**Files:** Modify: `cheep-backend-express/prisma/schema.prisma`; Create: yeni migration
- [ ] Şemayı incele: kullanılmayan/duplike kolonları, gereksiz raw payload saklamayı tespit et. `price_per_unit`/`unit_price` alanlarını `products`/`store_prices`'a ekle (karşılaştırma için).
- [ ] Migration yaz (`add_unit_price_and_cleanup`), `db:migrate:deploy`, `db:generate`. tsc yeşil.
- **Gate:** migrate status temiz; tsc + test yeşil; ölü alanlar kaldırılmış.

---

## Faz 3 — Backend Doğrulama (gerçek veri)

### Task 3.1: Gerçek veriyle ingest + endpoint doğrulama
**Files:** (doğrulama; gerekirse `ingest`/normalizer/matcher düzeltmeleri)
- [ ] Tüm marketleri scrape → match → `import_to_backend.py` (HTTP bulk-upsert, x-api-key) ile DB'ye yükle.
- [ ] Doğrula: `GET /products?...` (x-country=TR), `/products/:id/compare`, `/products/:id/history`, deals; gerçek veriyle doğru yanıt.
- **Gate:** kritik endpoint'ler gerçek veriyle doğru; tsc + vitest yeşil; DB'de ürün sayısı/kategori dağılımı raporu.

---

## Faz 4 — Mobil UI/UX Kökten Yenileme (Premium)

### Task 4.1: Tasarım sistemi cilası + Expo web/Playwright harness
**Files:** Modify: `Cheep-Mobile/src/theme/*`, `components/ui/*`; ortam: expo web
- [ ] `ui-ux-pro-max` rehberliği. Tipografi ölçeği, boşluk ritmi, gölge/renk token'larını premium seviyeye çek.
- [ ] `npx expo start --web` ayağa; Playwright ile bağlanıp temel ekranın SS'ini al (baseline).
- **Gate:** expo web çalışıyor; Playwright SS alıyor; tema tutarlı; tsc yeşil.

### Task 4.2: Ekran ekran yenileme (SS-driven iterate)
**Files:** Modify: `Cheep-Mobile/src/screens/*`, ilgili bileşenler
- [ ] Sırayla Auth → Home → Lists → Compare → Product Detail → Deals → Profile: Playwright ile aç, SS al, kusurları tespit et (boşluk, hiyerarşi, boş/yükleniyor/hata durumu, animasyon), düzelt, tekrar SS.
- [ ] Skeleton yükleme, boş durumlar, mikro-animasyonlar, erişilebilirlik (kontrast/label/dokunma hedefi).
- **Gate:** her ana ekranın nihai SS'i kaydedilmiş; akıcı ve tutarlı; mobil tsc yeşil.

---

## Faz 5 — Uçtan Uca & Teslim

### Task 5.1: Uçtan uca doğrulama + dokümantasyon + commit
**Files:** Modify: README'ler, docs; commit
- [ ] Tüm zincir: scrape → DB → API → mobil; Playwright ile uçtan uca senaryo + SS'ler.
- [ ] README/docs güncelle (yeni marketler, taksonomi, birim-başı fiyat, UI). Anlamlı commit'ler.
- **Gate:** uçtan uca yeşil; dürüst durum raporu (doğrulanan vs cihaz-gerektiren); branch hazır.

---

## Self-Review Notları
- Spec kapsamı: Faz 0-5 spec'in 1-7 bölümlerini karşılıyor (scraper, kategori, temizlik, backend, UI, teslim). BİM/Polonya kapsam dışı (spec §7 ile uyumlu).
- Placeholder yok: keşif gerektiren task'larda (ŞOK/A101 API) "probe → bul → implement" akışı açık; gate'ler somut.
- Tip tutarlılığı: `parse_quantity_and_unit`, `compute_unit_price`, `map_to_canonical`, `CANONICAL_TAXONOMY` tüm fazlarda aynı isimle.
