/**
 * Web fontlarını Google Fonts'tan indirip kendi sunucumuza taşır.
 *
 * Neden: `<link href="fonts.googleapis.com/...">` render'ı bloklayan bir istek
 * (Lighthouse'ta ~900 ms) ve üçüncü taraf bir bağlantı — Polonya/AB tarafında
 * ziyaretçi IP'sinin Google'a gitmesi ayrıca gereksiz. Kendi origin'imizden
 * servis edince blokaj kalkıyor ve dosyalar `immutable` cache'e giriyor.
 *
 * Sadece `latin` ve `latin-ext` alt kümeleri alınır: Türkçe (ı, ş, ğ) ve
 * Lehçe (ł, ż, ą, ę) karakterleri latin-ext'te.
 *
 * Kullanım (tek seferlik / font listesi değişince):  node scripts/fetch-fonts.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'fonts')
const cssOut = path.join(root, 'src', 'fonts.css')

const KEEP_SUBSETS = ['latin', 'latin-ext']

/**
 * Hanken ve Space Grotesk değişken (variable) sürümleriyle çekilir: `wght@400..700`
 * tek bir dosyada tüm ağırlıkları verir. Ağırlık başına ayrı dosya istemek
 * (400/500/600/700 × 2 alt küme) 12 ayrı font isteği demekti. Space Mono'nun
 * değişken sürümü yok; iki ağırlıkla kalıyor.
 */
const URL_CSS =
  'https://fonts.googleapis.com/css2' +
  '?family=Hanken+Grotesk:wght@400..700' +
  '&family=Space+Grotesk:wght@600..700' +
  '&family=Space+Mono:wght@400;700' +
  '&display=swap'

// woff2 alabilmek için modern bir tarayıcı UA'sı şart; aksi halde ttf döner.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const css = await (await fetch(URL_CSS, { headers: { 'User-Agent': UA } })).text()

fs.mkdirSync(outDir, { recursive: true })

// Google CSS'i şu blokları art arda verir: bir `/*` yorumunda subset adı
// (`latin`, `latin-ext`...), hemen ardından o subset'in `@font-face` kuralı.
//
// Bu açıklama BİLEREK satır yorumu. Eskiden bir JSDoc bloğuydu ve örnekteki
// yorum-kapatma dizisinin bloğu erken bitirmemesi için araya GÖRÜNMEZ bir
// sıfır genişlikli boşluk (U+200B) konmuştu. Kaynakta görünmez karakter
// başlı başına bir tuzak: kopyalanır, aranamaz ve lint'i tetikler.
// Satır yorumunda böyle bir kaçışa hiç gerek yok.
const blocks = css.split('/*').slice(1)
const kept = []

for (const raw of blocks) {
  const subset = raw.slice(0, raw.indexOf('*/')).trim()
  if (!KEEP_SUBSETS.includes(subset)) continue

  const body = raw.slice(raw.indexOf('*/') + 2)
  const family = /font-family:\s*'([^']+)'/.exec(body)?.[1]
  // Değişken fontta bu "400 700" gibi bir aralık olur, sabit fontta tek sayı.
  const weight = /font-weight:\s*([\d\s]+?);/.exec(body)?.[1]?.trim()
  const style = /font-style:\s*(\w+)/.exec(body)?.[1] ?? 'normal'
  const src = /src:\s*url\(([^)]+)\)/.exec(body)?.[1]
  const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1]
  if (!family || !weight || !src) continue

  const slug = family.toLowerCase().replace(/\s+/g, '-')
  const file = `${slug}-${weight.replace(/\s+/g, '-')}-${subset}.woff2`

  const buf = Buffer.from(await (await fetch(src)).arrayBuffer())
  fs.writeFileSync(path.join(outDir, file), buf)

  kept.push({ family, weight, style, file, range, size: buf.length })
}

const header = `/* Otomatik üretildi: node scripts/fetch-fonts.mjs — elle düzenleme.
   Kaynak: Google Fonts (Open Font License). Dosyalar public/fonts/ altında,
   kendi origin'imizden servis edilir. */\n\n`

const rules = kept
  .map(
    (f) => `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url('/fonts/${f.file}') format('woff2');
  unicode-range: ${f.range};
}`,
  )
  .join('\n\n')

fs.writeFileSync(cssOut, header + rules + '\n')

const total = kept.reduce((n, f) => n + f.size, 0)
console.log(`${kept.length} font dosyası (${Math.round(total / 1024)} KB) → public/fonts/`)
for (const f of kept) console.log(`  ${f.file.padEnd(38)} ${Math.round(f.size / 1024)} KB`)
