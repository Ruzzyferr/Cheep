import { SITE_URL, PLAY_URL, PLAY_PACKAGE, SUPPORT_EMAIL } from '../config'
import { DICTS, LOCALES, localePrefix, type Locale } from '../i18n'

export type PageKey = 'home' | 'privacy' | 'terms' | 'del'

/** Dilden bağımsız rota tablosu. Prerender ve sitemap bunu dolaşır. */
export const PAGES: { key: PageKey; path: string }[] = [
  { key: 'home', path: '/' },
  { key: 'privacy', path: '/privacy' },
  { key: 'terms', path: '/terms' },
  { key: 'del', path: '/delete' },
]

export function pageUrl(locale: Locale, path: string): string {
  const prefix = localePrefix(locale)
  const p = path === '/' ? '' : path
  // Kök için sondaki eğik çizgi korunur (https://cheep.live/), diğerlerinde yok.
  return `${SITE_URL}${`${prefix}${p}` || '/'}`
}

/** Bir sayfanın tüm dillerdeki karşılıkları — hreflang ve sitemap için. */
export function alternatesFor(path: string): { locale: Locale; url: string }[] {
  return LOCALES.map((locale) => ({ locale, url: pageUrl(locale, path) }))
}

function ogImage(locale: Locale): string {
  return `${SITE_URL}/og${locale === 'tr' ? '' : `-${locale}`}.png`
}

export type MetaTag = { name?: string; property?: string; content: string }
export type LinkTag = { rel: string; href: string; hreflang?: string }

export type Head = {
  lang: string
  title: string
  description: string
  meta: MetaTag[]
  links: LinkTag[]
  jsonLd: unknown[]
}

export function buildHead(locale: Locale, key: PageKey, path: string): Head {
  const t = DICTS[locale]
  const page = t.seo[key]
  const url = pageUrl(locale, path)
  const image = ogImage(locale)

  const links: LinkTag[] = [{ rel: 'canonical', href: url }]
  for (const alt of alternatesFor(path)) {
    links.push({ rel: 'alternate', hreflang: alt.locale, href: alt.url })
  }
  // Dili eşleşmeyen kullanıcılar için varsayılan sürüm.
  links.push({ rel: 'alternate', hreflang: 'x-default', href: pageUrl('tr', path) })

  const meta: MetaTag[] = [
    { name: 'description', content: page.description },
    { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' },
    { property: 'og:site_name', content: 'Cheep' },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: t.ogLocale },
    { property: 'og:title', content: page.title },
    { property: 'og:description', content: page.description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: page.title },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: page.title },
    { name: 'twitter:description', content: page.description },
    { name: 'twitter:image', content: image },
  ]

  for (const alt of alternatesFor(path)) {
    if (alt.locale !== locale) meta.push({ property: 'og:locale:alternate', content: DICTS[alt.locale].ogLocale })
  }

  return { lang: t.htmlLang, title: page.title, description: page.description, meta, links, jsonLd: jsonLd(locale, key, url) }
}

function jsonLd(locale: Locale, key: PageKey, url: string): unknown[] {
  const t = DICTS[locale]
  const out: unknown[] = []

  const organization = {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Cheep',
    url: SITE_URL,
    logo: `${SITE_URL}/cheep-favicon.svg`,
    email: SUPPORT_EMAIL,
  }

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'Cheep',
    inLanguage: t.htmlLang,
    publisher: { '@id': `${SITE_URL}/#organization` },
  }

  out.push({ '@context': 'https://schema.org', '@graph': [organization, website] })

  if (key === 'home') {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Cheep',
      operatingSystem: 'Android 8.0+',
      applicationCategory: 'ShoppingApplication',
      inLanguage: t.htmlLang,
      description: t.seo.appDescription,
      url,
      installUrl: PLAY_URL,
      downloadUrl: PLAY_URL,
      identifier: PLAY_PACKAGE,
      publisher: { '@id': `${SITE_URL}/#organization` },
      // Uydurma puan yok: aggregateRating yalnızca gerçek Play verisi olunca eklenir.
      offers: { '@type': 'Offer', price: '0', priceCurrency: locale === 'pl' ? 'PLN' : 'TRY' },
    })

    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: t.htmlLang,
      mainEntity: t.faq.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
  }

  return out
}

const ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPE[c])

/** Head'i statik HTML'e çevirir (prerender kullanır). */
export function renderHead(head: Head): string {
  const lines = [`<title>${esc(head.title)}</title>`]

  // `data-seo`: istemci tarafı gezinmede bu etiketler toptan silinip yeniden yazılır.
  for (const m of head.meta) {
    const attr = m.name ? `name="${esc(m.name)}"` : `property="${esc(m.property!)}"`
    lines.push(`<meta data-seo ${attr} content="${esc(m.content)}" />`)
  }
  for (const l of head.links) {
    const hl = l.hreflang ? ` hreflang="${esc(l.hreflang)}"` : ''
    lines.push(`<link data-seo rel="${esc(l.rel)}"${hl} href="${esc(l.href)}" />`)
  }
  for (const block of head.jsonLd) {
    // `</script>` kaçışı: JSON içindeki `<` script etiketini erken kapatmasın.
    const json = JSON.stringify(block).replace(/</g, '\\u003c')
    lines.push(`<script data-seo type="application/ld+json">${json}</script>`)
  }

  return lines.join('\n    ')
}
