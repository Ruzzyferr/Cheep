import { SITE_URL } from '../config'
import type { Locale } from '../i18n'
import { CONTENT, fill, fillLocalized } from '../i18n/content'
import type { Head } from './pages'
import type { PageData } from '../data/context'
import { summarize, isStale } from '../data/types'
import { formatAge, formatMoney, formatPct } from '../lib/money'
import { formatNumber } from '../lib/format'
import { categoryPath, storePath } from '../data/routes'

/**
 * İçerik sayfalarının <head>'i ve yapılandırılmış verisi.
 *
 * Tanıtım sayfalarından (`pages.ts`) ayrı: onlar dile göre çift, bunlar
 * ülkeye özel ve hreflang çiftleri YOK. Ürün slug'ları ülke kataloğundan
 * geliyor; TR "Sütaş Süt" ile PL "Mleko Łaciate" birbirinin çevirisi değil,
 * ikisini hreflang ile eşlemek Google'a yanlış bilgi vermek olurdu.
 */

// og:locale etiketleri. Dil + ULKE cifti olmak zorunda (yalniz dil kodu
// gecersiz); Hirvatca hr_HR, Macarca hu_HU, Romence ro_RO.
const ISO: Record<Locale, string> = {
  tr: 'tr_TR', en: 'en_US', pl: 'pl_PL', hr: 'hr_HR', hu: 'hu_HU', ro: 'ro_RO',
}

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
  // Her dil KENDI kokune. Once `: '/pl'` idi — yani Hirvat, Macar, Romen ve
  // Ingilizce sayfalarin HEPSINDE 'ana sayfa' kirinti baglantisi LEHCE
  // ana sayfaya gidiyordu.
  const homePath = locale === 'tr' ? '/' : `/${locale}`
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

      const title = fillLocalized(locale, c.seo.productTitle, {
        name: p.name,
        stores: s.storeCount,
      })

      // Tasarruf cümlesi yalnızca GERÇEK bir tasarruf varsa yazılır.
      // Koşulsuz eklendiğinde indekslenen ürün sayfalarının ~%18'i arama
      // sonucunda "%0 tasarruf et" diye çağrıda bulunuyordu — bir fiyat
      // karşılaştırma sitesi için hem tıklanma hem inandırıcılık kaybı.
      // Sayfa gövdesinde bu kapı (`savingPct >= 1`) zaten vardı; açıklamaya
      // konmamıştı.
      const hasSaving = s.savingPct >= 1
      const description = fillLocalized(
        locale,
        hasSaving ? c.seo.productDescSaving : c.seo.productDesc,
        {
          name: p.name,
          store: s.cheapest.storeName,
          price: money(s.min),
          stores: s.storeCount,
          pct: formatPct(locale, s.savingPct),
        },
      )

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
              // DOM ile AYNI metin: sayfada `formatAge` ile göreli yaş
              // ("15 gün önce") yazıyordu, JSON-LD ise ISO tarih. Google'ın
              // yapılandırılmış veri kuralı cevabın sayfada GÖRÜNMESİNİ
              // şart koşuyor; ayrışma her ürün sayfasında içerik uyuşmazlığı
              // olarak işaretlenir ve FAQ işaretlemesi site geneli bastırılabilir.
              text: fill(c.product.a1, {
                store: s.cheapest.storeName,
                price: money(s.min),
                date: formatAge(locale, s.cheapest.updatedAt, now),
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
      const title = fill(c.seo.categoryTitle, { name: cat.name, suffix: pageSuffix })
      const description = fillLocalized(locale, c.category.intro, {
        name: cat.name,
        count: formatNumber(locale, cat.productCount),
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
      const title = fill(c.seo.storeTitle, { name: s.name })
      // SAYILAR BICIMLENDIRILIR. Aciklama ham tam sayi basiyordu ("3067 sube")
      // ama sayfanin govdesi ayni sayiyi `formatNumber` ile ("3.067") ciziyordu:
      // arama snippet'i hem okunmasi zor bir sayi gosteriyor hem de tikladigi
      // sayfayla GORUNUR bicimde celisiyordu.
      const description = fillLocalized(locale, c.store.intro, {
        name: s.name,
        products: formatNumber(locale, s.productCount),
        branches: formatNumber(locale, s.branchCount),
        cities: formatNumber(locale, s.cityCount),
      })
      const head = base(locale, path, title, description, INDEXABLE)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: s.name }]))
      return head
    }

    case 'storeCategory': {
      const { store, category } = payload
      const title = fill(c.seo.storeCategoryTitle, { store: store.name, name: category.name })
      // AÇIKLAMA MARKET ADINI DA TAŞIR. Eskiden yalnızca kategori adı ve
      // sayı vardı, yani A101/BİM/ŞOK'un aynı kategori sayfaları BAYT BAYT
      // AYNI açıklamayı paylaşıyordu — Google'ın "Duplicate, Google chose
      // different canonical" dediği tam tablo.
      const description = fillLocalized(locale, c.storeCategory.intro, {
        store: store.name,
        name: category.name,
        count: payload.products.length,
      })

      // İNCE İÇERİK EŞİĞİ: 1-2 ürünlük bir market×kategori sayfası arama
      // sonucunda değer üretmiyor ama site geneli kalite sinyalini aşağı
      // çekiyor (şehir sayfaları aynı sebeple zaten NOINDEX'e alınmıştı).
      // Canlıda ölçüldü: 609 market×kategori URL'sinin ~%35'i ≤2 ürün.
      // Sayfa yine ERİŞİLEBİLİR kalır, yalnızca indekslenmez.
      const MIN_URUN_INDEKS = 3
      const head = base(
        locale,
        path,
        title,
        description,
        payload.products.length >= MIN_URUN_INDEKS ? INDEXABLE : NOINDEX,
      )
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
      const title = fill(c.seo.cityTitle, { name: city.name })
      const description = fillLocalized(locale, c.city.intro, { name: city.name, branches: formatNumber(locale, city.branchCount) })
      // NOINDEX — bu sayfalar sablondan uretiliyor ve birbirine %84-91 benziyor.
      // Ozgun icerik sayfa basina ~300 karakter: sehir adi, sube sayisi, zincir
      // dagilimi. Gerisi menu + alt bilgi. Google bunlari zaten "Duplicate,
      // Google chose different canonical than user" diyerek indekslemiyordu;
      // sitemap'te tutmak celiskili sinyaldi.
      //
      // Icerik ekleyerek COZULEMEZ: 275 sehir arasinda yalnizca 12 farkli zincir
      // bilesimi var (PL'de 230 sehrin 115'i ayni bilesimde). Sayfalari gercekten
      // ayristiracak veri sube adresleri/ilceleri; StoreBranch'te alan var ama
      // NULL — yalnizca lat/lon dolu. Ters geocoding ile ilce cikarilirsa burasi
      // INDEXABLE'a geri alinmali.
      //
      // `follow` bilincli: sayfalar kullaniciya acik kaliyor ve ic baglantilar
      // market sayfalarina link degeri tasimaya devam ediyor.
      const head = base(locale, path, title, description, NOINDEX)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: city.name }]))
      return head
    }

    case 'report': {
      const title = c.seo.reportTitle
      const head = base(locale, path, title, c.report.lead, INDEXABLE)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: c.report.title }]))
      return head
    }

    case 'products': {
      const title = c.seo.productsTitle
      // Yer tutucular SİLİNMİYOR, DOLDURULUYOR. `.replace(/\{\w+\}/g, '')`
      // sayıları atıyordu ve `priority 0.9` olan bu hub sayfasının açıklaması
      // canlıda " ürünü  markette karşılaştır." diye çıkıyordu — baştaki
      // boşlukla, sayısız, bozuk bir cümle. Aynı metin og:description olarak
      // da yayınlandığı için her sosyal paylaşım da böyle görünüyordu.
      const head = base(
        locale,
        path,
        title,
        fill(c.products.lead, {
          products: formatNumber(locale, payload.totals.products),
          stores: formatNumber(locale, payload.totals.stores),
        }),
        INDEXABLE,
      )
      head.jsonLd.push(
        breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: c.products.title }]),
      )
      return head
    }

    case 'compare': {
      const title = c.seo.compareTitle
      const head = base(locale, path, title, c.compare.lead, INDEXABLE)
      head.jsonLd.push(breadcrumbLd([{ name: c.breadcrumbHome, path: homePath }, { name: c.compare.title }]))
      return head
    }
  }
}
