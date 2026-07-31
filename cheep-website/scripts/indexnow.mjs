/**
 * IndexNow — Bing, Yandex ve Seznam'a "bu URL'ler değişti" bildirimi.
 *
 * Google IndexNow'u desteklemiyor (ve 2023'te sitemap ping ucunu kapattı);
 * Google tarafı Search Console'dan sitemap gönderimiyle yürüyor. Bu script
 * diğer motorlar için: içerik değişince tek komutla haber verir.
 *
 * Anahtar dosyası `public/<key>.txt` olarak sitede yayınlanmak zorunda —
 * IndexNow sahipliği böyle doğruluyor.
 *
 * Kullanım:  node scripts/indexnow.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOST = 'cheep.live'

const keyFile = fs
  .readdirSync(path.join(root, 'public'))
  .find((f) => /^[a-f0-9]{16,128}\.txt$/.test(f))

if (!keyFile) throw new Error('public/ altında IndexNow anahtar dosyası yok')
const key = keyFile.replace('.txt', '')

// Sitemap ile aynı liste kalsın diye dist/sitemap.xml'den okunur.
const sitemap = fs.readFileSync(path.join(root, 'dist', 'sitemap.xml'), 'utf8')
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${keyFile}`,
    urlList,
  }),
})

console.log(`IndexNow: ${res.status} ${res.statusText} — ${urlList.length} URL`)
if (!res.ok) console.log(await res.text())
