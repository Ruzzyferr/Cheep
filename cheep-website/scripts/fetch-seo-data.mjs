/**
 * Gecelik build'in veri adımı: backend'den SEO export'unu çeker ve diske yazar.
 *
 * Ayrı bir adım olmasının sebebi: prerender'ı ağdan bağımsız tutmak. Veri bir
 * kez indirilir, prerender defalarca çalıştırılabilir (geliştirme sırasında
 * önemli) ve API çökse bile ELDEKİ veriyle build tamamlanabilir.
 *
 * Ortam:
 *   SEO_API_URL   varsayılan http://backend:3000/api/v1  (docker ağı içi)
 *   INGEST_API_KEY zorunlu
 *   SEO_DATA_FILE varsayılan .seo-data.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.SEO_API_URL || 'http://backend:3000/api/v1'
const KEY = process.env.INGEST_API_KEY
const OUT = path.join(root, process.env.SEO_DATA_FILE || '.seo-data.json')

if (!KEY) {
  console.error('fetch-seo-data: INGEST_API_KEY yok.')
  process.exit(1)
}

const started = Date.now()
const res = await fetch(`${API}/seo/export`, { headers: { 'x-api-key': KEY } })

if (!res.ok) {
  console.error(`fetch-seo-data: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`)
  process.exit(1)
}

const body = await res.json()
const data = body?.data

// Şekil doğrulaması: bozuk veriyle 7.800 sayfa üretip yayına almak,
// build'i burada düşürmekten çok daha pahalı.
if (!data || !Array.isArray(data.countries) || data.countries.length === 0) {
  console.error('fetch-seo-data: beklenen şekil yok (data.countries boş).')
  process.exit(1)
}

for (const c of data.countries) {
  const ok = c.code && Array.isArray(c.products) && Array.isArray(c.categories) && Array.isArray(c.stores)
  if (!ok) {
    console.error(`fetch-seo-data: ${c.code || '?'} ülkesinde eksik alan var.`)
    process.exit(1)
  }
}

fs.writeFileSync(OUT, JSON.stringify(data))

const mb = (fs.statSync(OUT).size / 1048576).toFixed(1)
const secs = ((Date.now() - started) / 1000).toFixed(1)
console.log(`seo verisi: ${mb} MB, ${secs}s → ${path.relative(root, OUT)}`)
for (const c of data.countries) {
  console.log(
    `  ${c.code}: ${c.products.length} ürün, ${c.categories.length} kategori, ` +
      `${c.stores.length} market, ${c.cities.length} şehir`,
  )
}
