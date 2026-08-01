import { SITE_URL } from '../config'
import type { Locale } from '../i18n'
import { CONTENT, fill } from '../i18n/content'
import type { Head } from './pages'
import type { PageData } from '../data/context'
import { summarize, isStale } from '../data/types'
import { formatMoney, formatPct } from '../lib/money'
import { categoryPath, storePath } from '../data/routes'

/**
 * İçerik sayfalarının <head>'i ve yapılandırılmış verisi.
 *
 * Tanıtım sayfalarından (`pages.ts`) ayrı: onlar dile göre çift, bunlar
 * ülkeye özel ve hreflang çiftleri YOK. Ürün slug'ları ülke kataloğundan
 * geliyor; TR "Sütaş Süt" ile PL "Mleko Łaciate" birbirinin çevirisi değil,
 * ikisini hreflang ile eşlemek Google'a yanlış bilgi vermek olurdu.
 */

const ISO: Record<Locale, string> = { tr: 'tr_TR', pl: 'pl_PL' }

function base(locale: Locale, path: string, title: string, description: string, robots: string): Head {
  const url = `${SITE_URL}${path}`
  return {
    lang: locale,
    title,
    description,
    // Kendine canonical: sayfalama dahil her sayfa kendini işaret eder.
    // 2. sayfayı 1'e canonical etmek yaygın bir hata — oradaki ürünler
    // indeksten düşer.
    links: [{ rel: 'canonical', href: url }],
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: robots },
      { property: 'og:site_name', content: 'Cheep' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: ISO[locale] },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    jsonLd: [],
  }
}

const INDEXABLE = 'index, follow, max-image-preview:large, max-snippet:-1'
const NOINDEX = 'noindex, follow'

function breadcrumbLd(items: { name: string; path?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: `${SITE_URL}${it.path}` } : {}),
    })),
  }
}

/**
 * Sayfa verisinden <head> üretir. Prerender her sayfa için bunu çağırır.
 */
export function buildContentHead(locale: Locale, path: string, data: PageData): Head {
  const c = CONTENT[locale]
  const { country, payload } = data
  const now = new Date(country.generatedAt)
  const homePath = locale === 'tr' ? '/' : '/pl'
  const money = (v: number) => formatMoney(locale, country.currency, v)

  switch (payload.kind) {
    // Anasayfanın <head>'i buradan gelmiyor — `seo/pages.ts` üretiyor, çünkü
    // anasayfa hem TR hem PL'de var ve hreflang çiftli. Buraya yalnızca canlı
    // veri taşıyıcısı olarak uğruyor; başlık üretilirse çakışırdı.
    case 'home':
      return base(locale, path, 'Cheep', c.report.lead, INDEXABLE)

    case 'product': {
      const p = payload.product
      const s = summarize(p.offers)
      if (!s) {
        return base(locale, path, p.name, c.product.noOffers, NOINDEX)
      }

      const title =
        locale === 'tr'
          ? `${p.name} fiyatları — ${s.storeCount} markette karşılaştır | Cheep`
          : `${p.name} — ceny w ${s.storeCount} sklepach | Cheep`

      const description =
        locale === 'tr'
          ? `${p.name} en ucuz ${s.cheapest.storeName}: ${money(s.min)}. ${s.storeCount} marketin güncel fiyatlarını karşılaştır, ${formatPct(locale, s.savingPct)} tasarruf et.`
          : `${p.name} najtaniej w ${s.cheapest.storeName}: ${money(s.min)}. Porównaj ceny w ${s.storeCount} sklepach i oszczędź ${formatPct(locale, s.savingPct)}.`

      // Bayat fiyatlı sayfa indekslenmez (spec §9) — yanlış fiyat göstermek
      // güveni ve sıralamayı birlikte yakar.
      const head = base(locale, path, title, description, isStale(s.updatedAt, now) ? NOINDEX : INDEXABLE)

      if (p.image) head.meta.push({ property: 'og:image', content: p.image })

      // AggregateOffer: Google arama sonucunda fiyat aralığını gösterir
      // ("₺32–₺47 · 5 markette"). Rakiplerin çoğunda yok, tıklanmayı artırıyor.
      head.jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
        ...(p.image ? { image: p.image } : {}),
        ...(p.categoryName ? { category: p.categoryName } : {}),
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: country.currency,
          lowPrice: s.min.toFixed(2),
          highPrice: s.max.toFixed(2),
          offerCount: s.storeCount,
          availability: 'https://schema.org/InStock',
          offers: p.offers.map((o) => ({
            '@type': 'Offer',
            price: o.price.toFixed(2),
            priceCurrency: country.currency,
            seller: { '@type': 'Organization', name: o.storeName },
            availability: 'https://schema.org/InStock',
          })),
        },
      })

      head.jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: fill(c.product.q1, { name: p.name }),
            acceptedAnswer: {
              '@type': 'Answer',
              text: fill(c.product.a1, {
                store: s.cheapest.storeName,
                price: money(s.min),
                date: new Date(s.cheapest.updatedAt).toISOString().slice(0, 10),
              }),
            },
          },
          {
            '@type': 'Question',
            name: fill(c.product.q2, { name: p.name }),
            acceptedAnswer: {
              '@type': 'Answer',
              text: fill(c.product.a2, {
                min: money(s.min),
                max: money(s.max),
                abs: money(s.savingAbs),
                pct: formatPct(locale, s.savingPct),
              }),
            },
          },
        ],
      })

      head.jsonLd.push(
        breadcrumbLd([
          { name: c.breadcrumbHome, path: homePath },
          ...(p.categorySlug && p.categoryName
            ? [{ name: p.categoryName, path: categoryPath(locale, p.categorySlug) }]
            : []),
          { name: p.name },
        ]),
      )
      return head
    }

    case 'category': {
      const cat = payload.category
      const pageSuffix = payload.page > 1 ? ` — ${c.pagination.page} ${payload.page}` : ''
      const title =
        locale === 'tr'
          ? `${cat.name} fiyatları${pageSuffix} | Cheep`
          : `${cat.name} — ceny${pageSuffix} | Cheep`
      const description = fill(c.category.intro, {
        name: cat.name,
        count: cat.productCount,
        stores: payload.stores.length,
      })

      const head = base(locale, path, title, description, INDEXABLE)
      head.jsonLd.push(
        breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: cat.name }]),
      )
      return head
    }

    case 'store': {
      const s = payload.store
      const title =
        locale === 'tr' ? `${s.name} fiyatları ve şubeleri | Cheep` : `${s.name} — ceny i sklepy | Cheep`
      const description = fill(c.store.intro, {
        name: s.name,
        products: s.productCount,
        branches: s.branchCount,
        cities: s.cityCount,
      })
      const head = base(locale, path, title, description, INDEXABLE)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: s.name }]))
      return head
    }

    case 'storeCategory': {
      const { store, category } = payload
      const title =
        locale === 'tr'
          ? `${store.name} ${category.name} fiyatları | Cheep`
          : `${store.name} — ${category.name} ceny | Cheep`
      const description = fill(c.category.introSingle, {
        name: category.name,
        count: payload.products.length,
      })
      const head = base(locale, path, title, description, payload.products.length > 0 ? INDEXABLE : NOINDEX)
      head.jsonLd.push(
        breadcrumbLd([
          { name: c.breadcrumbHome, path: homePath },
          { name: store.name, path: storePath(locale, store.slug) },
          { name: category.name },
        ]),
      )
      return head
    }

    case 'city': {
      const city = payload.city
      const title =
        locale === 'tr'
          ? `${city.name} marketleri — en ucuz market ve şubeler | Cheep`
          : `${city.name} — sklepy i najtańsze ceny | Cheep`
      const description = fill(c.city.intro, { name: city.name, branches: city.branchCount })
      const head = base(locale, path, title, description, INDEXABLE)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: city.name }]))
      return head
    }

    case 'report': {
      const title = locale === 'tr' ? 'Market zam raporu — güncel fiyat değişimleri | Cheep' : 'Raport cen — zmiany cen | Cheep'
      const head = base(locale, path, title, c.report.lead, INDEXABLE)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: c.report.title }]))
      return head
    }

    case 'products': {
      const title =
        locale === 'tr'
          ? 'Ürünler — market fiyatlarını karşılaştır | Cheep'
          : 'Produkty — porównaj ceny w sklepach | Cheep'
      const head = base(locale, path, title, c.products.lead.replace(/\{\w+\}/g, ''), INDEXABLE)
      head.jsonLd.push(
        breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: c.products.title }]),
      )
      return head
    }

    case 'browse': {
      const title =
        locale === 'tr'
          ? 'Market fiyatları — kategori, market ve şehre göre karşılaştır | Cheep'
          : 'Ceny w sklepach — kategorie, sklepy i miasta | Cheep'
      const head = base(locale, path, title, c.browse.lead.replace(/\{\w+\}/g, ''), INDEXABLE)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: c.browse.title }]))
      return head
    }

    case 'compare': {
      const title =
        locale === 'tr' ? 'En ucuz market hangisi? Karşılaştırma | Cheep' : 'Który sklep jest najtańszy? | Cheep'
      const head = base(locale, path, title, c.compare.lead, INDEXABLE)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: c.compare.title }]))
      return head
    }
  }
}
