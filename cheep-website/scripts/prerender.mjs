/**
 * Build sonrası statik site üretimi (SSG).
 *
 * `vite build` (istemci) ve `vite build --ssr` çalıştıktan sonra koşar:
 *   dist/index.html          → şablon (hash'li asset linkleriyle)
 *   dist-ssr/entry-server.js → sunucu render'ı
 *
 * İki tür sayfa üretir:
 *   1. Tanıtım sayfaları — her dil × rota (anasayfa, yasal metinler)
 *   2. İçerik sayfaları  — `.seo-data.json` varsa ürün/kategori/market/şehir
 *
 * İçerik verisi yoksa (yerel geliştirme, API'siz ortam) yalnızca tanıtım
 * sayfaları üretilir ve build başarılı sayılır — veri yokluğu bir hata değil,
 * "bugün içerik üretmiyoruz" demek.
 *
 * Böylece Googlebot JS çalıştırmadan tüm metni, canonical'ı, hreflang'i ve
 * JSON-LD'yi görür; ziyaretçi de boş ekran yerine hazır sayfa görür (hydrate).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildPageList, buildHomePayload } from './content-pages.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

const server = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href)
const {
  render,
  buildHead,
  renderHead,
  buildContentHead,
  PAGES,
  pageUrl,
  alternatesFor,
  LOCALES,
  localePrefix,
  DICTS,
  serializeData,
  DATA_GLOBAL,
  routes,
} = server

let template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

if (!template.includes('<!--app-head-->') || !template.includes('<!--app-html-->')) {
  throw new Error('index.html şablonunda <!--app-head--> / <!--app-html--> yer tutucuları yok')
}

/**
 * CSS'i satır içine al ve <link rel=stylesheet>'i kaldır.
 *
 * Tek CSS dosyası ilk boyamayı blokluyordu (Lighthouse mobil: ~1,6 sn tasarruf).
 * Sayfa zaten prerender edildiği için stil belgeyle birlikte gelirse ilk boyama
 * fazladan bir gidiş-dönüş beklemiyor. Maliyet: gzip'te ~8 KB, sayfa başına
 * tekrar eden ve ayrı cache'lenmeyen bir yük — arama sonucundan gelen ilk
 * ziyaret ağırlıklı bir sitede bu takas net kazanç.
 */
const cssLink = /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/
const cssMatch = template.match(cssLink)

/** Tanıtım sayfaları: CSS satır içi. */
let marketingTemplate = template
/** İçerik sayfaları: CSS dış dosyadan (aşağıdaki gerekçe). */
const contentTemplate = template

if (cssMatch) {
  const css = fs.readFileSync(path.join(dist, cssMatch[1].slice(1)), 'utf8')
  marketingTemplate = template.replace(cssLink, `<style>${css}</style>`)
  console.log(`inline css:  ${Math.round(css.length / 1024)} KB → yalnızca tanıtım sayfaları`)
} else {
  console.warn('uyarı: dist/index.html içinde stylesheet linki bulunamadı, satır içine alınmadı')
}

/** Dil öneki + dilden bağımsız yol → gerçek URL yolu ('/pl/terms'). */
function routePath(locale, pagePath) {
  const prefix = localePrefix(locale)
  return `${prefix}${pagePath === '/' ? '' : pagePath}` || '/'
}

/**
 * Bir sayfayı diske yazar.
 *
 * `inlineCss` neden sayfa tipine göre değişiyor: CSS 48 KB. Sekiz tanıtım
 * sayfasına gömmek ilk boyamayı hızlandıran net kazançtı. 7.661 içerik
 * sayfasına gömmek ise aynı 48 KB'ı her sayfada tekrarlamak demek — diskte
 * ~370 MB, ve içerik sayfalarında gezinen kullanıcı (kategori → ürün → ürün)
 * aynı stili defalarca indiriyor. Dış dosya bir kez indirilip önbelleğe
 * giriyor; ikinci sayfadan itibaren bedava.
 */
function writePage(url, head, html, dataScript = '', inlineCss = true) {
  const out = (inlineCss ? marketingTemplate : contentTemplate)
    // Şablondaki yer tutucu başlık: sayfaya özgü <title> renderHead'den geliyor.
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace('<html lang="tr">', `<html lang="${head.lang}">`)
    // Veri script'i <head>'de: uygulama JS'inden ÖNCE çalışmalı, yoksa
    // istemci veriyi bulamaz ve hydration sunucudan farklı DOM üretir.
    .replace('<!--app-head-->', renderHead(head) + dataScript)
    .replace('<!--app-html-->', html)

  // '/' → dist/index.html, '/pl/terms' → dist/pl/terms/index.html
  const outDir = url === '/' ? dist : path.join(dist, url)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'index.html'), out)
}

// -------------------------------------------------- anasayfa canlı verisi
/**
 * Anasayfa artık gerçek fiyat verisi gösteriyor (LiveDrops bölümü). Veri
 * içerik sayfalarıyla aynı kaynaktan, ama anasayfa hem TR hem PL'de var ve
 * her biri kendi ülkesinin verisini gösteriyor.
 */
const dataFileEarly = path.join(root, process.env.SEO_DATA_FILE || '.seo-data.json')
const seoData = fs.existsSync(dataFileEarly) ? JSON.parse(fs.readFileSync(dataFileEarly, 'utf8')) : null
const homePayloads = {}

if (seoData) {
  for (const country of seoData.countries) {
    const locale = routes.COUNTRY_LOCALE[country.code]
    if (!locale) continue
    homePayloads[locale] = {
      country: { code: country.code, currency: country.currency, generatedAt: seoData.generatedAt },
      payload: buildHomePayload(country),
    }
  }

  // INGILIZCE ANASAYFA TR VERISINI GOSTERIR.
  //
  // `en` bir PAZAR degil, bir dil yedegi: `COUNTRY_LOCALE` icinde karsiligi
  // yok, dolayisiyla dongu ona bir payload uretmiyor. Bos birakilsaydi
  // anasayfanin urun/fiyat bolumleri veri olmadan cizilecekti — App Store'un
  // Ingilizce listelemesinden gelen ziyaretcinin gordugu ILK ekran bu.
  // TR'yi secmek tutarli: magazadaki Ingilizce ekran goruntuleri de TR
  // magazalarini ve TL fiyatlarini gosteriyor.
  if (!homePayloads.en && homePayloads.tr) homePayloads.en = homePayloads.tr
}

// ------------------------------------------------------- tanıtım sayfaları
const marketing = []

for (const locale of LOCALES) {
  for (const page of PAGES) {
    const url = routePath(locale, page.path)
    // Yalnızca anasayfa canlı veri alıyor; yasal sayfaların işi yok.
    const pageData = page.key === 'home' ? homePayloads[locale] ?? null : null
    const script = pageData ? `<script>window.${DATA_GLOBAL}=${serializeData(pageData)}</script>` : ''
    writePage(url, buildHead(locale, page.key, page.path), render(url, pageData), script)
    marketing.push({ url, path: page.path, key: page.key, locale })
  }
}

// -------------------------------------------------------- içerik sayfaları
const dataFile = path.join(root, process.env.SEO_DATA_FILE || '.seo-data.json')
const content = []
let skipped = 0

if (fs.existsSync(dataFile)) {
  const seo = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  const started = Date.now()

  for (const country of seo.countries) {
    const locale = routes.COUNTRY_LOCALE[country.code]
    if (!locale) {
      console.warn(`uyarı: ${country.code} için dil eşlemesi yok, atlandı`)
      continue
    }

    const meta = { code: country.code, currency: country.currency, generatedAt: seo.generatedAt }
    const list = buildPageList(country, locale, routes)

    for (const page of list) {
      const pageData = { country: meta, payload: page.payload }
      const head = buildContentHead(locale, page.path, pageData)

      // noindex sayfalar üretiliyor ama sitemap'e GİRMİYOR: Google'a
      // "burayı indeksleme" deyip aynı anda sitemap'te sunmak çelişkili sinyal.
      const indexable = !head.meta.some((m) => m.name === 'robots' && m.content.includes('noindex'))
      if (!indexable) skipped++

      const script = `<script>window.${DATA_GLOBAL}=${serializeData(pageData)}</script>`
      writePage(page.path, head, render(page.path, pageData), script, false)

      if (indexable) {
        content.push({ url: page.path, priority: page.priority, changefreq: page.changefreq })
      }
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`içerik:      ${content.length + skipped} sayfa (${secs}s), ${skipped} tanesi noindex`)
} else {
  console.log('içerik:      .seo-data.json yok — yalnızca tanıtım sayfaları üretildi')
}

// ------------------------------------------------------- kategori 301'leri
/**
 * Taksonomi birleştirmesinde silinen/yeniden adlandırılan kategori slug'ları
 * için 301 kuralları.
 *
 * `/kategori/meyve-ve-sebze` gibi URL'ler yayındaydı ve birleştirme sonrası
 * kayboldu. Yönlendirmeden vazgeçmek birikmiş sıralamayı yakar ve kullanıcıyı
 * 404'e düşürür.
 *
 * Dosya HER ZAMAN yazılır (boş olsa da): Caddyfile onu `import` ediyor ve
 * eksik dosya Caddy'yi başlatmaz.
 */
{
  const lines = []
  if (seoData) {
    for (const country of seoData.countries) {
      const locale = routes.COUNTRY_LOCALE[country.code]
      if (!locale) continue
      for (const r of country.redirects ?? []) {
        const from = routes.categoryPath(locale, r.from)
        const to = routes.categoryPath(locale, r.to)
        if (from === to) continue
        lines.push(`redir ${from} ${to} 301`)
        // Sayfalı hâlleri de taşı: /kategori/<slug>/2 gibi URL'ler indekste.
        lines.push(`redir ${from}/* ${to} 301`)
      }
    }
  }
  const header = '# Otomatik üretildi (scripts/prerender.mjs). Elle düzenlemeyin.'
  // Kaldırılan keşif sayfası → ürünler. Yayındaydı ve indekste; sessizce
  // 404'e düşürmek birikmiş sıralamayı ve gelen bağlantıları yakar.
  lines.push('redir /fiyatlar /urunler 301')
  lines.push('redir /fiyatlar/* /urunler 301')
  lines.push('redir /pl/ceny /pl/produkty 301')
  lines.push('redir /pl/ceny/* /pl/produkty 301')

  const body =
    lines.length > 0
      ? [header, ...lines, ''].join('\n')
      : ['# Yönlendirme yok.', ''].join('\n')
  fs.writeFileSync(path.join(dist, 'redirects.caddy'), body)
  console.log(`301:         ${lines.length} kural → dist/redirects.caddy`)
}

// ------------------------------------------------------------------- 404
/**
 * Gerçek 404 sayfası.
 *
 * Daha önce Caddy bilinmeyen yolları index.html'e düşürüyordu: tarayıcı 200
 * alıyor, anasayfa HTML'i geliyor, istemci ise "bulunamadı" çiziyordu —
 * hydration uyuşmazlığı (#418) ve Google için "soft 404". Artık her geçerli
 * URL'in gerçek bir dosyası var, yani SPA geri dönüşüne hiç gerek yok.
 *
 * Sayfa BİLEREK hydrate edilmiyor: uygulama JS'i çıkarılıyor. 404'ün
 * etkileşime ihtiyacı yok ve script'siz sayfa hiçbir koşulda uyuşmazlık
 * üretemez. İki dilde birden yazıyor, çünkü statik dosya ziyaretçinin dilini
 * bilemez.
 */
// HER DİLDE BİR 404 — liste artık ELLE YAZILMIYOR.
//
// Burada önce tek bir TR sayfası vardı; sonra Lehçe eklendi ve liste iki
// satıra çıktı. Site beş dile geçince aynı hata ÜÇ dilde birden geri döndü:
// Hırvatça/Macarca/Romence bir yoldan gelen ziyaretçi baştan sona TÜRKÇE bir
// hata sayfası ve Türkçe anasayfaya giden tek bir düğme görüyordu.
//
// Liste artık `LOCALES` üzerinden türetiliyor: yeni bir dil eklendiğinde 404'ü
// KENDİLİĞİNDEN geliyor. URL, o dilin ürün rota parçasından üretiliyor —
// 404 şablonu var olmayan bir ürün yoluna basılıyor ki uygulama gerçekten
// "bulunamadı" durumunu render etsin. Metinler sözlükten (`notFound`).
for (const { url: notFoundUrl, lang, title, description, out } of LOCALES.map((locale) => {
  const prefix = localePrefix(locale)
  const productSegment = routes.segment(locale, 'product')
  const dict = DICTS[locale]
  return {
    locale,
    lang: locale,
    url: `${prefix}/${productSegment}/__cheep-404__`,
    title: dict.notFound.title,
    description: dict.notFound.description,
    out: prefix ? `${prefix.slice(1)}/404.html` : '404.html',
  }
})) {
  const head = {
    lang,
    title,
    description,
    meta: [{ name: 'robots', content: 'noindex, follow' }],
    links: [],
    jsonLd: [],
  }
  const html = marketingTemplate
    // `<html lang>` DE DEĞİŞMELİ. Normal sayfa yolu bunu yapıyor (yukarıda),
    // ama 404 kendi zincirini kurduğu için o adım atlanmıştı: Lehçe 404
    // doğru başlık ve doğru gövdeyle geliyor ama `<html lang="tr">` diyordu.
    // Ekran okuyucu sayfayı Türkçe telaffuz ediyor, Google da dili yanlış
    // okuyor — üstelik sayfa noindex olduğu için kimse fark etmiyordu.
    .replace('<html lang="tr">', `<html lang="${lang}">`)
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace('<!--app-head-->', renderHead(head))
    .replace('<!--app-html-->', render(notFoundUrl, null))
    // Uygulama JS'ini çıkar → hydration hiç denenmez.
    .replace(/<script type="module"[^>]*><\/script>/g, '')
    .replace(/<link rel="modulepreload"[^>]*>/g, '')

  const outPath = path.join(dist, out)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, html)
  console.log(`404:         dist/${out} (hydrate edilmiyor)`)
}

// ---------------------------------------------------------------- sitemap
const today = new Date().toISOString().slice(0, 10)
const entries = []

for (const m of marketing) {
  const alts = alternatesFor(m.path)
    .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.locale}" href="${a.url}" />`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl('tr', m.path)}" />`)
    .join('\n')

  entries.push(
    [
      '  <url>',
      `    <loc>${pageUrl(m.locale, m.path)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${m.key === 'home' ? 'daily' : 'yearly'}</changefreq>`,
      `    <priority>${m.key === 'home' ? '1.0' : '0.5'}</priority>`,
      alts,
      '  </url>',
    ].join('\n'),
  )
}

// İçerik sayfalarının hreflang alternatifi YOK: ürün kataloğu ülkeye özel,
// TR ve PL sayfaları birbirinin çevirisi değil (gerekçe: src/seo/content.ts).
for (const c of content) {
  entries.push(
    [
      '  <url>',
      `    <loc>https://cheep.live${c.url}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${c.changefreq}</changefreq>`,
      `    <priority>${c.priority}</priority>`,
      '  </url>',
    ].join('\n'),
  )
}

/** Sitemap dosya başına URL sınırı — protokol 50.000 diyor, altında kalıyoruz. */
const SITEMAP_LIMIT = 45000
const wrap = (body) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`

if (entries.length <= SITEMAP_LIMIT) {
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), wrap(entries.join('\n')))
  console.log(`sitemap:     ${entries.length} URL → dist/sitemap.xml`)
} else {
  // Katalog büyüyüp sınır aşılırsa sessizce kırılmasın: index'e böl.
  const chunks = []
  for (let i = 0; i < entries.length; i += SITEMAP_LIMIT) chunks.push(entries.slice(i, i + SITEMAP_LIMIT))

  chunks.forEach((chunk, i) => {
    fs.writeFileSync(path.join(dist, `sitemap-${i + 1}.xml`), wrap(chunk.join('\n')))
  })

  const index =
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    chunks
      .map(
        (_, i) =>
          `  <sitemap>\n    <loc>https://cheep.live/sitemap-${i + 1}.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
      )
      .join('\n') +
    `\n</sitemapindex>\n`

  fs.writeFileSync(path.join(dist, 'sitemap.xml'), index)
  console.log(`sitemap:     ${entries.length} URL → ${chunks.length} dosya + index`)
}

console.log(`prerender:   ${marketing.length} tanıtım + ${content.length + skipped} içerik sayfası`)
