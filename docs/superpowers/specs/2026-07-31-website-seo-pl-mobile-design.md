# Cheep website — SEO, Lehçe sürüm, Play Store ve mobil düzeltmeleri

**Tarih:** 2026-07-31
**Kapsam:** `cheep-website/` (Vite + React 19 + React Router 7 SPA), `deploy/Caddyfile`

## Sorun

Uygulama Play Store'da production'da. Web sitesi ise:

1. **Arama motorlarında görünmüyor.** Saf CSR SPA — `index.html` gövdesi boş (`<div id="root">`), indekslenecek tek satır metin yok. `robots.txt` ve `sitemap.xml` yok (SPA fallback yüzünden `/robots.txt` HTML dönüyor). Canonical, og:image, twitter card, yapılandırılmış veri yok. Tek `<title>` tüm rotalar için paylaşılıyor.
2. **Polonya lansmanı sitede yarım.** Site tamamen Türkçe; Lehçe arama yapan Polonyalı kullanıcı siteyi bulamıyor. Sayılar bayat (aşağıda) ve birkaç cümle Polonya'yı yok sayıyor ("her hafta güncellenir" — PL hattı günlük; "T.C. Ticaret Bakanlığı resmi verisi" cümlesi tek kaynak gibi duruyor).
3. **İndirme butonu ölü.** `Download.tsx` iki buton da `href="#"` ve "Yakında" etiketli — uygulama yayında olmasına rağmen.
4. **Mobil bozuk.** Hero'daki WebGL aurora shader'ın okunabilirlik scrim'i masaüstü düzenine (sol üst metin bloğu) göre ayarlı; dar portre viewport'ta clementine blob doğrudan başlık ve gövde metninin arkasına düşüyor, gri metin turuncu üstünde okunmuyor. Mobilde gezinme menüsü hiç yok (linkler `md:flex` ardında gizli). Footer/nav linkleri 18 px yüksekliğinde (dokunma hedefi eşiği 44 px). Maskot `lg:` altında tamamen gizli, hero'nun üst yarısı boş.

### Bayat sayılar (prod'dan doğrulandı, 2026-07-31)

| Yer | Sitede | Gerçek |
|---|---|---|
| `Coverage` TR şube | 7.272 | **10.247** |
| `Coverage` PL şube | 13.422 | 13.422 ✓ |
| `Savings` eşleştirilmiş ürün | 18.000+ | **55.000+** (TR 15.619 + PL 39.743) |
| `Savings` market şubesi | 16.500+ | **23.500+** |
| `Savings` güncelleme sıklığı | "7 günde bir" | **günlük** |
| `Compare`/`Coverage` metni | "her hafta güncellenen" | "her gün güncellenen" |

Kaynak: `https://api.cheep.live/api/v1/products?limit=1` (pagination.total, `x-country` başlığıyla) ve prod Postgres (`deploy-db-1`) şube sayımı.

## Kararlar

Kullanıcı tarafından onaylanan üç kapsam kararı:

- **Dil:** TR + PL, hreflang'li. (EN şimdilik yok.)
- **Render:** Build zamanı prerender (SSG). Sadece meta yeterli değil.
- **Butonlar:** Play Store canlı, App Store soluk "Yakında".

## Tasarım

### 1. Prerender (SSG)

Standart Vite SSG deseni. `App.tsx` ikiye ayrılır: router-bağımsız `AppRoutes` + istemcide `BrowserRouter` saran `App`.

- `scripts/entry-server.tsx` — `StaticRouter` + `renderToString`, `{ html, head }` döner.
- `scripts/prerender.mjs` — `vite build` (istemci) → `vite build --ssr` → her rota için render → `dist/<rota>/index.html` yaz → `sitemap.xml` üret.
- `package.json`: `build` = `tsc -b && node scripts/prerender.mjs`.
- `Caddyfile` (website): `try_files {path} {path}/index.html /index.html` — prerender edilmiş dizin HTML'i varsa onu, yoksa SPA fallback'i sunar.

**SSR güvenliği:**
- `HeroCanvas` istemci-özel: `React.lazy` + mount-sonrası + masaüstü-medya koşulu. Sunucuda hiç render edilmez; three.js ana bundle'dan da çıkar.
- `gsap/ScrollTrigger` ve `lenis` modül-üstü import'tan `useEffect` içine dinamik import'a taşınır (modül yüklenirken `document`'e dokunmasınlar + ilk bundle küçülsün).
- `CountUp` sunucuda **son değeri** basar (bugün `0` basıyor); istemcide animasyon yine 0'dan başlar. Prerender edilmiş HTML'de gerçek sayılar görünür.
- `Reveal` zaten `useEffect` içinde gizliyor → prerender çıktısı görünür metin içerir. Değişiklik yok.

**Rotalar:**

| TR | PL |
|---|---|
| `/` | `/pl` |
| `/privacy` | `/pl/privacy` |
| `/terms` | `/pl/terms` |
| `/delete` | `/pl/delete` |

### 2. Head / meta

Harici head kütüphanesi yok. `src/seo/pages.ts` rota+dil → `{ title, description, path }` haritası tutar; prerender bunu HTML şablonuna basar, istemcide `useSeo` SPA gezinmesinde `document.title` ve description'ı günceller.

Her sayfaya: `<title>`, `meta description`, `link rel=canonical`, `og:title/description/image/url/type/locale`, `twitter:card=summary_large_image`, `hreflang` üçlüsü (`tr`, `pl`, `x-default` → TR).

**JSON-LD** (`src/seo/jsonld.ts`): `SoftwareApplication` (Android, Play URL, `offers.price = 0`), `Organization`, `WebSite`. Uydurma `aggregateRating` **yok**.

**Statik dosyalar:** elle yazılan `public/robots.txt` (sitemap işaretli), build'de üretilen `dist/sitemap.xml` (8 rota, hreflang alternatifleriyle).

**Sosyal kart:** `public/og.png` ve `public/og-pl.png` (1200×630), `scripts/gen-og.py` ile HTML'den Playwright screenshot olarak üretilir.

### 3. SSS bölümü

Ana sayfaya, Download'dan önce, altı soruluk bir SSS. İki işi var: (a) uzun kuyruk aramalar için indekslenebilir gerçek metin — bugün sitede hiç yok; (b) `FAQPage` JSON-LD ile zengin sonuç adaylığı. H1 sloganı ("Aynı ürün. En ucuz fiyat.") korunur; anahtar kelimeler title/description/SSS metnine girer.

### 4. i18n

`src/i18n/tr.ts` ve `pl.ts` aynı şekilli sözlükler (`Dict` tipiyle derleme zamanı kontrolü), `LocaleContext` ile dağıtılır. Bileşenler string literal tutmaz.

Dile bağlı **içerik** farkları (çeviri değil, yerelleştirme):
- Hero ticker: TR'de ₺ ürünleri, PL'de zł ürünleri (Biedronka, Lidl, Żabka, Auchan, Carrefour).
- `Compare` kartı: PL sürümünde Lehçe ürün + zł fiyatlar.
- Veri kaynağı atfı: TR'de T.C. Ticaret Bakanlığı (marketfiyati.org.tr), PL'de zincirlerin herkese açık kaynakları.
- Footer imzası ve para/sayı biçimlendirmesi (`tr-TR` / `pl-PL`).

Yasal sayfalar da Lehçeye çevrilir (Play Store PL listelemesi için gerekli). **Hukuki metnin kullanıcı tarafından gözden geçirilmesi gerekir** — çeviri sadakatli, ama hukuki denklik iddiası taşımaz.

### 5. Google Play

Resmi rozet inline SVG olarak (harici istek yok — CSP/performans). Hedef:
`https://play.google.com/store/apps/details?id=com.cheep.mobile` + `utm_source=website` etiketi (Play Console'da web trafiğini ayırt etmek için). `target="_blank" rel="noopener"`. "Yakında" etiketi kalkar. App Store butonu soluk, `aria-disabled`, tıklanmaz.

### 6. Mobil

- **Aurora canvas mobilde yüklenmez.** Yerine hero'nun mevcut CSS gradyanı görünür. Hem kontrast sorunu biter hem LCP/pil kazanır. Masaüstünde aynen kalır.
- Nav'a hamburger + tam ekran menü; dil seçici de burada.
- Hero: mobilde maskot geri gelir; ticker'ın kapladığı alan kadar alt boşluk ayrılır (bugün çakışıyor).
- Tüm dokunma hedefleri ≥ 44 px (footer ve nav linkleri).
- `safe-area-inset` desteği (çentikli/gesture-bar cihazlar).

## Doğrulama

- `scripts/mobileaudit.py` — 360 px ve 390 px'te tam sayfa görüntü + yatay taşma ve dokunma hedefi denetimi. Uygulama öncesi çıktı referans olarak alındı.
- Prerender çıktısı: `dist/index.html` ve `dist/pl/index.html` içinde başlık metni, SSS metni ve JSON-LD gövdede aranır (JS çalıştırmadan).
- Lighthouse (mobil) SEO + erişilebilirlik.
- Deploy sonrası Google Search Console'a her iki dil için sitemap gönderimi.

## Kapsam dışı

- EN sürümü ve DE/CH/SE ülkelerinin açılışı.
- Blog / içerik pazarlaması.
- `www.cheep.live` (DNS'te yok; canonical `https://cheep.live`).
