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
  // Ingilizce yol parcalari: ICERIK SAYFASI URETILMIYOR (bkz. en.ts basligi),
  // ama `SEGMENTS` tipi Locale'in tamamini istiyor ve tanitim sayfalarindaki
  // gezinme baglantilari (`/products`) bu tablodan cozuluyor.
  en: {
    product: 'product',
    category: 'category',
    store: 'store',
    city: 'city',
    report: 'price-report',
    compare: 'cheapest-stores',
    products: 'products',
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
  // URL parçaları AKSANSIZ yazılır (Lehçe satırın 'najtansze' yazması gibi):
  // aksanlı karakter adres çubuğunda yüzde-kodlanmış görünür, paylaşılan
  // bağlantıyı çirkinleştirir ve bazı istemcilerde bozulur.
  hr: {
    product: 'proizvod',
    category: 'kategorija',
    store: 'trgovina',
    city: 'grad',
    report: 'izvjestaj-cijena',
    compare: 'najjeftinije-trgovine',
    products: 'proizvodi',
  },
  hu: {
    product: 'termek',
    category: 'kategoria',
    store: 'bolt',
    city: 'varos',
    report: 'arjelentes',
    compare: 'legolcsobb-boltok',
    products: 'termekek',
  },
  ro: {
    product: 'produs',
    category: 'categorie',
    store: 'magazin',
    city: 'oras',
    report: 'raport-preturi',
    compare: 'cele-mai-ieftine-magazine',
    products: 'produse',
  },
}

/** Hangi ülke verisi hangi dilde yayınlanıyor. */
export const COUNTRY_LOCALE: Record<string, Locale> = { TR: 'tr', PL: 'pl', HR: 'hr', HU: 'hu', RO: 'ro' }

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

/**
 * Bu yol bir İÇERİK sayfası mı? (ürün / kategori / market / şehir / rapor /
 * karşılaştırma / ürünler hub'ı)
 *
 * NEDEN GEREKLİ: içerik sayfalarının diğer dilde KARŞILIĞI YOK — dosyanın
 * başındaki nota bakın; TR ve PL katalogları farklı ürünler. Buna rağmen
 * gezinti çubuğundaki dil değiştirici yalnızca `/pl` önekini takıp
 * atıyordu, yani `/urun/koska-cikos...` → `/pl/urun/koska-cikos...` gibi
 * ASLA var olmayan bir adres üretiyordu. Sonuç: ~7.600 içerik sayfasının
 * her birinde dil düğmesi 404'e gidiyordu ve Googlebot da aynı bağlantıyı
 * her sayfada izleyip tarama bütçesini ölü adreslere harcıyordu.
 *
 * Yol parçası HER İKİ dilin sözlüğüne göre sınanıyor: kullanıcı zaten
 * `/pl/produkt/...` üzerindeyse de doğru cevabı vermeliyiz.
 */
export function isContentPath(pathname: string): boolean {
  const first = pathname.replace(/^\/+/, '').split('/')[0]
  if (!first) return false
  return (Object.keys(SEGMENTS) as Locale[]).some((loc) =>
    Object.values(SEGMENTS[loc]).includes(first),
  )
}

/** Kategori sayfası başına ürün adedi (spec §5). */
export const PAGE_SIZE = 60
