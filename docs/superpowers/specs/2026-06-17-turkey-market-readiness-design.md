# Cheep — Türkiye Pazarına Hazırlık (Tasarım / Spec)

- **Tarih:** 2026-06-17
- **Durum:** Onaylandı (tasarım), spec gözden geçirmesi bekleniyor
- **Sahip:** Ruzgar Emir

## 1. Amaç (North Star)

Cheep'i Türkiye pazarı için üretime hazır hale getirmek:

- **Doğru veri:** 4-6 ulusal zincirden çekilen ürünlerin **isim / fiyat / gramaj / kategori** bilgileri doğru olacak.
- **Temiz veri:** Şemada ve pipeline'da gereksiz/duplike veri tutulmayacak.
- **Mükemmel kategoriler:** Kanonik, iyi ayrıştırılmış hiyerarşik taksonomi; her ürün doğru kategoride.
- **Kökten premium mobil UI/UX:** Her ekran yeniden tasarlanacak/cilalanacak, akıcı ve premium.
- **Doğrulanmış:** Her şey canlı veri + Playwright (tarayıcı) ile doğrulanacak. Ekran görüntüleriyle UI kanıtlanacak.

**Kabul ölçütü (genel):** "Emin olmadan bitti deme." Her faz somut kanıtla (gerçek veri örneklemesi, yeşil testler, ekran görüntüleri) kapanır.

## 2. İlkeler

1. **Faz başına doğrulama kapısı.** Bir faz, kanıtı üretilmeden bitmiş sayılmaz.
2. **Market başına strateji:** Önce **API probe** (Migros deseni — ucuz, hızlı, sağlam). API yoksa/erişilemiyorsa **Playwright + persistent context** (Carrefour deseni, Cloudflare bypass).
3. **Feasibility-dürüstlük:** Çekilemeyen market/kaynak net raporlanır; veri uydurulmaz.
4. **Mevcut desenleri izle:** config-tabanlı runner, dataclass `Product`, country multi-tenancy, Kafka/HTTP ingest yolları korunur.

## 3. Ortam Gerçeği (bu oturumda doğrulanmış)

| Yetenek | Durum |
|---|---|
| Python 3.12 + Playwright + Chromium 141 | ✅ Kurulu |
| ŞOK (sokmarket.com.tr) | ✅ HTTP 200 — XHR API (homepage'de `__NEXT_DATA__` yok → network capture gerek) |
| A101 (a101.com.tr) | ⚠️ 403 (Cloudflare) → Playwright gerek |
| Migros API | ⚠️ Tarayıcı UA ile 404 (403 değil) → endpoint/slug güncel değil, onarılabilir |
| Postgres (localhost:5432) | 🔧 Başlangıçta kapalı; Docker Desktop başlatıldı → compose ile ayağa kaldırılacak |
| Node 24 / pnpm 10 | ✅ |
| Pipeline LLM (OpenAI gpt-4o-mini) | ❌ `.env` anahtarı 429 / kredi yok → **pipeline LLM'siz** (deterministik kural+fuzzy), Claude (geliştirme) doğrular |
| Runtime AI (uygulama içi sohbet) | 🟢 **Google Gemini** (`gemini-2.0-flash`, ücretsiz tier). Runtime doğrulama için `GEMINI_API_KEY` gerekir |

## 4. Kapsam ve Fazlar

### Faz 0 — Ortam & Temel
- Docker daemon hazır → `docker compose` (gerekirse kök compose / ya da tek Postgres servisi) ile Postgres ayağa.
- `pnpm install` (gerekirse), `pnpm db:migrate:deploy`, `pnpm db:generate`.
- Baseline yeşil: backend `tsc`, `vitest`, mobil `tsc`.
- **Mevcut Migros scraper'ını canlı onar:** doğru API endpoint/slug; gerekirse Playwright fallback. `category_mapping.py` slug'ları güncelle.
- **Kapı:** Backend ayakta + DB bağlı + Migros canlı veri çekiyor (örnek ürünler doğrulanmış).

### Faz 1 — Scraper'lar (yeni marketler + altyapı)
**Altyapı:**
- İki `Product` dataclass'ını **tek modele** indir (`scrapers/base_scraper.py` kanonik kaynak olsun).
- **Gramaj/birim parse güçlendirme:** `kg/g/l/ml/adet/paket/kutu`, çoklu paket (`2x200 g` → 400 g), ondalık (`1,5 L`), ürün adından gramaj çıkarımı.
- **Birim-başı fiyat** (`price_per_unit`, ör. TL/kg, TL/L) — adil karşılaştırma için. Backend/şema bunu destekliyor mu kontrol; gerekiyorsa eklenir (Faz 2/3 ile koordineli).

**Marketler (eklenebilecek her şey — feasibility'ye göre):**
- **ŞOK:** Playwright ile network capture → gerçek API endpoint keşfi → API scraper (tercih). API yoksa DOM scrape.
- **A101:** Playwright + persistent context (Cloudflare). Carrefour deseni.
- **Macrocenter:** Migros API altyapısını yeniden kullan (premium banner, aynı altyapı varsayımı — doğrulanacak).
- **Tarım Kredi Kooperatif Market:** Probe → feasible ise ekle.
- **Diğer feasible kaynaklar** (Getir/Banabi, File, Hakmar vb.): yalnızca hızlı probe pozitifse ve maliyeti düşükse eklenir; aksi halde raporlanır.
- Her market `countries/turkey/config.json`'a eklenir; `run_scrapers.py` ile çalışır.

**Kapı:** Her eklenen market canlı veri döndürür; her market için ≥1 örnek sayfa üzerinde isim/fiyat/gramaj/kategori el ile + script ile doğrulanır. Çekilemeyenler raporlanır.

### Faz 2 — Veri Kalitesi & Kategori Taksonomisi
- **Kanonik hiyerarşik taksonomi** tanımla (TR market gerçeğine uygun). Üst kategoriler (örnek):
  Meyve & Sebze · Et, Tavuk & Balık · Süt & Kahvaltılık · Temel Gıda (bakliyat, makarna, un, yağ, baharat) · Atıştırmalık & Şekerleme · İçecek (sıcak/soğuk/alkolsüz) · Donuk Gıda · Fırın & Pastane · Temizlik · Kağıt & Hijyen · Kişisel Bakım · Bebek · Ev & Yaşam · Pet Shop.
  Her üst kategori altında net alt kategoriler.
- **Eşleme:** scraper ham kategori → kanonik kategori (deterministik kural tablosu + LLM normalizer doğrulaması). Yanlış kategoriye düşen ürünleri yakalama mekanizması (raporla + düzelt).
- **"Gereksiz veri yok":** Prisma şemasında kullanılmayan/duplike alanları temizle; raw payload saklamayı sınırla; `price_history` yalnızca değişimde (mevcut davranış korunur); ölü kolon/tablo varsa migration ile kaldır.
- **Cross-market matching** kalitesini 5-6 markette doğrula (aynı ürün farklı marketlerde tek `muadil_grup` altında).
- **Kapı:** Kategori dağılım raporu (kategori başına ürün sayısı, "Diğer/boş" oranı düşük) + rastgele N=100 ürün örneklemesinde doğru-kategori oranı raporlanır; gramaj/fiyat doğruluğu N örnekte kontrol edilir.

### Faz 3 — Backend Doğrulama
- Gerçek scrape veriyle DB doldur (HTTP `bulk-upsert` veya Kafka yolu; `x-api-key` ile).
- Gerçek veriyle doğrula: `GET /products` (country filtre), `/products/:id/compare`, `/products/:id/history`, deals, `x-country` scoping.
- **Kapı:** Kritik endpoint'ler gerçek veriyle doğru yanıt veriyor; `tsc` + `vitest` yeşil.

### Faz 4 — Mobil UI/UX Kökten Yenileme (Premium)
- `ui-ux-pro-max` + `frontend-design` rehberliği. Mevcut fintech yönü temel; daha da premium: tipografi ölçeği, boşluk ritmi, mikro-animasyon/geçişler, skeleton yükleme, boş/hata/again durumları, dokunma hedefleri, erişilebilirlik (kontrast, label).
- Her ana ekran gözden geçirilir/yeniden tasarlanır: Auth, Home, Lists, Compare, Product Detail (fiyat geçmişi), Deals, Profile.
- **Doğrulama döngüsü:** `expo start --web` → Playwright ile her ekrana git → **ekran görüntüsü al** → kusurları tespit et → düzelt → tekrar SS. Gerçek (seed/scrape) veriyle.
- **Kapı:** Her ana ekranın "önce/sonra" veya nihai SS'i; tutarlı tasarım sistemi; akıcı navigasyon; mobil `tsc` yeşil.

### Faz 5 — Uçtan Uca & Teslim
- Tüm zincir: scrape → (DB/Kafka) → API → mobil. Playwright ile uçtan uca senaryo + SS'ler.
- README/docs güncelle (yeni marketler, taksonomi, birim-başı fiyat, UI). Commit (push istenirse ayrıca).
- **Kapı:** Uçtan uca yeşil + dürüst durum raporu: neler canlı doğrulandı, neler (native cihaz gibi) doğrulanamadı.

## 5. Mimari Etkiler (özet)

- **Scraper:** tek `Product` modeli; güçlendirilmiş unit parser; market başına API/Playwright scraper; config-driven runner korunur.
- **Şema/DB:** kanonik kategori ağacı (mevcut hiyerarşik `categories` kullanılır); olası `price_per_unit`/`unit_price` alanı; gereksiz alan temizliği (migration).
- **Backend:** mevcut ingest yolları (HTTP + Kafka) korunur; kategori eşleme normalizer'da.
- **Mobil:** tema token'ları + bileşen kütüphanesi üzerinde kökten cilalama; veri kontratı değişmez (veya değişirse koordineli).

## 6. Riskler & Açık Sorular

- **Market API keşfi:** ŞOK/A101/Tarım Kredi endpoint'leri Playwright probe ile netleşene kadar kesin değil. Cloudflare sertleşirse A101 gecikebilir.
- **Pipeline LLM kararı:** OpenAI anahtarı kredisiz (429). Karar: **pipeline LLM'siz** — deterministik fuzzy matcher (Levenshtein/Jaccard) + kural/regex tabanlı kanonik kategori eşleme. Kalite Claude (geliştirme) ile gerçek veri üzerinde doğrulanır. Maliyet yok.
- **Runtime AI (Gemini):** Uygulama içi AI sohbeti `gemini-2.0-flash` (ücretsiz tier) kullanır. Yayındaki uygulama kendi `GEMINI_API_KEY`'ini ister; runtime doğrulama bu anahtara bağlıdır (kod+kontrat anahtarsız hazırlanır, sohbet anahtar gelince doğrulanır).
- **Expo web ≠ native:** Web'de doğrulama native'in birebir aynısı değil; native-only farklar typecheck + not ile kapatılır.
- **Scraping etiği/hukuk:** rate-limit korunur; yalnızca herkese açık fiyat verisi; robots/şartlar dikkate alınır (mevcut README uyarısı geçerli).

## 7. Kapsam Dışı (YAGNI)

- BİM (online SKU-bazlı fiyat kataloğu yok; broşür-OCR ayrı bir epic).
- Polonya/yeni ülke genişlemesi (altyapı hazır, bu turda veri eklenmez).
- Yeni backend özellikleri (watchlist, push alerter consumer vb.) — yalnızca veri doğruluğu/temizliği için gerekenler.
- RAG doğal-dil fiyat asistanı, fotoğraf→liste (vision) — bu turda hariç (ileride eklenebilir).

## 8. Yapay Zeka Asistanı (Gemini)

Uygulamaya tam AI desteği: **Google Gemini** (`gemini-2.0-flash`, ücretsiz tier) ile üç kullanıcı-yönelik özellik. Sağlayıcı soyutlanır (ileride OpenRouter/Claude'a geçilebilir).

**Mimari:** Backend'de izole bir `ai` modülü (Gemini client + prompt'lar + DB-grounding). Mobilde bir **AI sohbet ekranı**. AI ürün önerirken **uydurmaz** — DB'deki gerçek ürünlerle eşler (isim+fuzzy), bulunmayanı "bulunamadı" der.

**Özellikler:**
1. **Yemek → liste:** Kullanıcı "şu yemekleri yapacağım" der → Gemini malzeme + gramaj çıkarır → DB ürünleriyle eşlenir → yeni bir alışveriş listesi oluşturulur, kullanıcı listeye yönlendirilir. (Porsiyon + diyet tercihi opsiyonel.)
2. **Bütçeye göre sepet:** "X TL'ye … sepet" → bütçe içinde ürün seti önerilir, compare-engine ile en ucuz market(ler)e dağıtılır.
3. **Haftalık yemek planı + liste:** "1 haftalık ekonomik plan" → 7 günlük menü + birleşik alışveriş listesi + en iyi rota.

**Endpoint taslağı (öneri):** `POST /api/v1/ai/recipe-list`, `/ai/budget-basket`, `/ai/meal-plan` (auth'lu, country-scoped). Gemini çıktısı yapılandırılmış JSON; backend DB-grounding + liste oluşturma yapar.

**Doğrulama:** Anahtar yokken kontrat + DB-grounding birim testleriyle; anahtar gelince gerçek Gemini yanıtıyla uçtan uca (Expo web + Playwright).
