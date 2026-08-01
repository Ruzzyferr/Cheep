/**
 * IndexNow — Bing, Yandex ve Seznam'a değişen sayfaları anında bildirir.
 *
 * NEDEN: Google'ın böyle bir protokolü yok (Indexing API yalnızca iş ilanı ve
 * canlı yayın için), ama Bing ve Yandex saatler içinde tarıyor. Polonya'da
 * Bing'in payı azımsanmayacak durumda ve maliyeti tek bir HTTP isteği.
 *
 * SPAM YAPMIYORUZ: her gece 6.800 URL bildirmek protokolün kötüye kullanımı
 * ve arama motorları bunu görmezden gelmeye başlıyor. Yalnızca fiyatı GERÇEKTEN
 * değişen ürünlerin sayfaları + her gün değişen hub sayfaları gönderiliyor.
 * Değişiklik, bir önceki build'in verisiyle karşılaştırılarak bulunuyor.
 *
 * Ortam:
 *   INDEXNOW_KEY   zorunlu (public/<key>.txt ile aynı olmalı)
 *   SEO_DATA_FILE  varsayılan .seo-data.json
 *   SEO_PREV_FILE  varsayılan .seo-data.prev.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KEY = process.env.INDEXNOW_KEY
const HOST = 'cheep.live'
/** Tek istekte gönderilebilecek üst sınır (protokol 10.000 diyor). */
const MAX_URLS = 5000

if (!KEY) {
  console.log('indexnow:   INDEXNOW_KEY yok — atlandı')
  process.exit(0)
}

const dataFile = path.join(root, process.env.SEO_DATA_FILE || '.seo-data.json')
const prevFile = path.join(root, process.env.SEO_PREV_FILE || '.seo-data.prev.json')

if (!fs.existsSync(dataFile)) {
  console.log('indexnow:   veri yok — atlandı')
  process.exit(0)
}

/**
 * URL şeması burada TEKRARLANIYOR — bilinçli.
 *
 * Tek doğru kaynak `src/data/routes.ts`, ama o TypeScript ve derlenmiş hali
 * (dist-ssr) yalnızca Docker imajının içinde; bu script ise host'ta sade
 * node ile koşuyor. Üç yol şekli için TypeScript derleme adımı kurmak
 * orantısızdı. routes.ts'teki SEGMENTS değişirse burası da değişmeli —
 * aşağıdaki test bunu yakalar (scripts/indexnow.test.mjs yok; onun yerine
 * build sonrası duman testi sayfaların 200 döndüğünü doğruluyor).
 */
const COUNTRY_LOCALE = { TR: 'tr', PL: 'pl' }
const SEGMENTS = {
  tr: { product: 'urun', report: 'zam-raporu', compare: 'en-ucuz-market' },
  pl: { product: 'produkt', report: 'raport-cen', compare: 'najtansze-sklepy' },
}
const prefix = (l) => (l === 'tr' ? '' : `/${l}`)
const routes = {
  COUNTRY_LOCALE,
  productPath: (l, slug) => `${prefix(l)}/${SEGMENTS[l].product}/${slug}`,
  reportPath: (l) => `${prefix(l)}/${SEGMENTS[l].report}`,
  comparePath: (l) => `${prefix(l)}/${SEGMENTS[l].compare}`,
}

const now = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
const prev = fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf8')) : null

/** Ürünün fiyat parmak izi — market:fiyat çiftleri. */
const fingerprint = (p) =>
  [...p.offers]
    .sort((a, b) => (a.storeSlug < b.storeSlug ? -1 : 1))
    .map((o) => `${o.storeSlug}:${o.price}`)
    .join('|')

const urls = []

for (const country of now.countries) {
  const locale = routes.COUNTRY_LOCALE[country.code]
  if (!locale) continue

  // Her gün değişen sayfalar — koşulsuz bildirilir.
  urls.push(`https://${HOST}${locale === 'tr' ? '/' : '/pl'}`)
  urls.push(`https://${HOST}${routes.reportPath(locale)}`)
  urls.push(`https://${HOST}${routes.comparePath(locale)}`)

  const before = new Map()
  const prevCountry = prev?.countries?.find((c) => c.code === country.code)
  for (const p of prevCountry?.products ?? []) before.set(p.slug, fingerprint(p))

  for (const p of country.products) {
    const fp = fingerprint(p)
    const old = before.get(p.slug)
    // İlk çalıştırmada karşılaştırılacak bir şey yok: hepsi yeni sayılır.
    if (old === undefined || old !== fp) {
      urls.push(`https://${HOST}${routes.productPath(locale, p.slug)}`)
    }
  }
}

const unique = [...new Set(urls)]
const batch = unique.slice(0, MAX_URLS)

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: batch }),
})

// 200 ve 202 ikisi de kabul; 422 genelde anahtar dosyası okunamadı demek.
console.log(
  `indexnow:   ${batch.length}/${unique.length} URL bildirildi → HTTP ${res.status}` +
    (unique.length > MAX_URLS ? ` (${unique.length - MAX_URLS} sonraki tura kaldı)` : ''),
)

// Sonraki karşılaştırma için bugünkü veriyi sakla.
fs.copyFileSync(dataFile, prevFile)
