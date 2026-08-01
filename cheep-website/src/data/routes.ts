/**
 * İçerik sayfalarının URL şeması.
 *
 * Yol parçaları dile çevriliyor (`/urun/...` ↔ `/pl/produkt/...`): Lehçe arama
 * yapan biri URL'de Türkçe kelime görmemeli, hem güven hem sıralama meselesi.
 *
 * ÖNEMLİ — bu sayfalar hreflang çifti DEĞİL. Ürün slug'ları ülkeye özel:
 * TR kataloğundaki "Sütaş Süt" ile PL kataloğundaki "Mleko Łaciate" farklı
 * ürünler, farklı marketler, farklı para birimi. Aralarında "aynı sayfanın
 * çevirisi" ilişkisi kurmak Google'a yalan söylemek olur. Yasal sayfalar ve
 * anasayfa çift olmaya devam ediyor (onlar gerçekten çeviri).
 */
import { localePrefix, type Locale } from '../i18n'

export type ContentKind =
  | 'product'
  | 'category'
  | 'store'
  | 'city'
  | 'report'
  | 'compare'
  | 'products'

/** Dil başına yol parçaları. */
const SEGMENTS: Record<Locale, Record<ContentKind, string>> = {
  tr: {
    product: 'urun',
    category: 'kategori',
    store: 'market',
    city: 'sehir',
    report: 'zam-raporu',
    compare: 'en-ucuz-market',
    products: 'urunler',
  },
  pl: {
    product: 'produkt',
    category: 'kategoria',
    store: 'sklep',
    city: 'miasto',
    report: 'raport-cen',
    compare: 'najtansze-sklepy',
    products: 'produkty',
  },
}

/** Hangi ülke verisi hangi dilde yayınlanıyor. */
export const COUNTRY_LOCALE: Record<string, Locale> = { TR: 'tr', PL: 'pl' }

export function segment(locale: Locale, kind: ContentKind): string {
  return SEGMENTS[locale][kind]
}

export function productPath(locale: Locale, slug: string): string {
  return `${localePrefix(locale)}/${segment(locale, 'product')}/${slug}`
}

export function categoryPath(locale: Locale, slug: string, page = 1): string {
  const base = `${localePrefix(locale)}/${segment(locale, 'category')}/${slug}`
  return page > 1 ? `${base}/${page}` : base
}

export function storePath(locale: Locale, slug: string): string {
  return `${localePrefix(locale)}/${segment(locale, 'store')}/${slug}`
}

export function storeCategoryPath(locale: Locale, storeSlug: string, categorySlug: string): string {
  return `${storePath(locale, storeSlug)}/${categorySlug}`
}

export function cityPath(locale: Locale, slug: string): string {
  return `${localePrefix(locale)}/${segment(locale, 'city')}/${slug}`
}

/** Ürünler sayfası — kataloğun tamamında arama/filtre/sıralama. */
export function productsPath(locale: Locale): string {
  return `${localePrefix(locale)}/${segment(locale, 'products')}`
}

export function reportPath(locale: Locale): string {
  return `${localePrefix(locale)}/${segment(locale, 'report')}`
}

export function comparePath(locale: Locale): string {
  return `${localePrefix(locale)}/${segment(locale, 'compare')}`
}

/** Kategori sayfası başına ürün adedi (spec §5). */
export const PAGE_SIZE = 60
