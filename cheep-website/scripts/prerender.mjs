/**
 * Build sonrası statik site üretimi (SSG).
 *
 * `vite build` (istemci) ve `vite build --ssr` çalıştıktan sonra koşar:
 *   dist/index.html          → şablon (hash'li asset linkleriyle)
 *   dist-ssr/entry-server.js → sunucu render'ı
 *
 * Her dil × rota için `dist/<yol>/index.html` yazar ve sitemap.xml üretir.
 * Böylece Googlebot JS çalıştırmadan tüm metni, canonical'ı, hreflang'i ve
 * JSON-LD'yi görür; ziyaretçi de boş ekran yerine hazır sayfa görür (hydrate).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

const server = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href)
const { render, buildHead, renderHead, PAGES, pageUrl, alternatesFor, LOCALES, localePrefix } = server

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
 * ziyaret ağırlıklı bir tanıtım sitesinde bu takas net kazanç.
 */
const cssLink = /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/
const cssMatch = template.match(cssLink)

if (cssMatch) {
  const css = fs.readFileSync(path.join(dist, cssMatch[1].slice(1)), 'utf8')
  template = template.replace(cssLink, `<style>${css}</style>`)
  console.log(`inline css:  ${Math.round(css.length / 1024)} KB (${cssMatch[1]})`)
} else {
  console.warn('uyarı: dist/index.html içinde stylesheet linki bulunamadı, satır içine alınmadı')
}

/** Dil öneki + dilden bağımsız yol → gerçek URL yolu ('/pl/terms'). */
function routePath(locale, pagePath) {
  const prefix = localePrefix(locale)
  return `${prefix}${pagePath === '/' ? '' : pagePath}` || '/'
}

const written = []

for (const locale of LOCALES) {
  for (const page of PAGES) {
    const url = routePath(locale, page.path)
    const head = buildHead(locale, page.key, page.path)

    const html = template
      // Şablondaki yer tutucu başlık: sayfaya özgü <title> renderHead'den geliyor.
      .replace(/<title>[\s\S]*?<\/title>\s*/, '')
      .replace('<html lang="tr">', `<html lang="${head.lang}">`)
      .replace('<!--app-head-->', renderHead(head))
      .replace('<!--app-html-->', render(url))

    // '/' → dist/index.html, '/pl/terms' → dist/pl/terms/index.html
    const outDir = url === '/' ? dist : path.join(dist, url)
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'index.html'), html)
    written.push(url)
  }
}

// ---------------------------------------------------------------- sitemap
const today = new Date().toISOString().slice(0, 10)
const entries = []

for (const locale of LOCALES) {
  for (const page of PAGES) {
    const alts = alternatesFor(page.path)
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.locale}" href="${a.url}" />`)
      .concat(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl('tr', page.path)}" />`,
      )
      .join('\n')

    entries.push(
      [
        '  <url>',
        `    <loc>${pageUrl(locale, page.path)}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${page.key === 'home' ? 'weekly' : 'yearly'}</changefreq>`,
        `    <priority>${page.key === 'home' ? '1.0' : '0.5'}</priority>`,
        alts,
        '  </url>',
      ].join('\n'),
    )
  }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`

fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap)

console.log(`prerender: ${written.length} sayfa → ${written.join(', ')}`)
console.log(`sitemap:   ${entries.length} URL → dist/sitemap.xml`)
