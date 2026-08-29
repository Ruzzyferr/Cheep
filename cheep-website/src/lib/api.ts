/**
 * Canlı API istemcisi — yalnızca ürünler sayfası kullanır.
 *
 * Sitenin geri kalanı statik üretiliyor ve verisini HTML'e gömülü payload'dan
 * alıyor. Ürünler sayfası ise arama, filtre ve sayfalama sunuyor: bunların tüm
 * kombinasyonlarını önceden üretmek mümkün değil (15.000+ ürün × kategori ×
 * market × sıralama). İlk ekran yine prerender ediliyor, sonrası buradan.
 */
import { API_URL } from '../config'
import type { Locale } from '../i18n'

/** Site dili → katalog ülkesi. Ürün kataloğu ülkeye özel. */
const COUNTRY_FOR_LOCALE: Record<Locale, string> = { tr: 'TR', pl: 'PL', hr: 'HR', hu: 'HU', ro: 'RO' }

export interface ApiOffer {
  price: string
  unit?: string | null
  store?: { id: number; name: string; slug?: string | null; logo_url?: string | null } | null
}

export interface ApiProduct {
  id: number
  slug: string | null
  name: string
  brand: string | null
  image_url: string | null
  category?: { id: number; name: string; slug: string | null } | null
  store_prices?: ApiOffer[]
}

export interface Facet {
  slug: string
  name: string
  n: number
}

export interface ProductsResponse {
  items: ApiProduct[]
  total: number
  hasMore: boolean
  facets?: { categories: Facet[]; stores: Facet[] }
}

/**
 * Ürünler sayfasının evreni: EN AZ İKİ MARKETTE bulunan ürünler.
 *
 * Prerender edilen ilk ekran da aynı eşiği kullanıyor (SEO export'u
 * `MIN_STORES_FOR_PAGE = 2` ile üretiliyor). Eşik olmasaydı sayfa "2.995 ürün"
 * yazıp filtre uygulandığında 16.000 sonuç gösterirdi — kullanıcıya çelişkili
 * iki sayı. Ayrıca tek markette bulunan ürünün karşılaştırma değeri yok;
 * sayfanın vaadi tam olarak karşılaştırma.
 */
export const MIN_STORES = 2

export interface ProductsQuery {
  search?: string
  categorySlug?: string
  storeSlugs?: string[]
  sort?: string
  minPrice?: number
  maxPrice?: number
  page?: number
  pageSize?: number
  withFacets?: boolean
}

export class ApiError extends Error {}

/**
 * Ürünleri çeker.
 *
 * `signal` ile iptal edilebilir: kullanıcı arama kutusuna yazarken her tuşta
 * yeni istek çıkıyor ve eski yanıtın yenisini ezmesi listeyi yanlış gösterirdi.
 */
export async function fetchProducts(
  locale: Locale,
  query: ProductsQuery,
  signal?: AbortSignal,
): Promise<ProductsResponse> {
  const pageSize = query.pageSize ?? 40
  const page = Math.max(1, query.page ?? 1)

  const params = new URLSearchParams()
  params.set('limit', String(pageSize))
  params.set('offset', String((page - 1) * pageSize))
  if (query.search) params.set('search', query.search)
  if (query.categorySlug) params.set('category_slug', query.categorySlug)
  if (query.storeSlugs?.length) params.set('store_slug', query.storeSlugs.join(','))
  if (query.sort) params.set('sort', query.sort)
  if (query.minPrice !== undefined) params.set('min_price', String(query.minPrice))
  if (query.maxPrice !== undefined) params.set('max_price', String(query.maxPrice))
  if (query.withFacets) params.set('facets', '1')
  params.set('min_stores', String(MIN_STORES))

  const res = await fetch(`${API_URL}/products?${params.toString()}`, {
    signal,
    headers: {
      'x-country': COUNTRY_FOR_LOCALE[locale],
      // Kategori adları sunucuda çevriliyor; site dili neyse o.
      'x-lang': locale,
    },
  })

  if (!res.ok) {
    throw new ApiError(`Ürünler alınamadı (HTTP ${res.status})`)
  }

  const body = (await res.json()) as {
    data?: ApiProduct[]
    pagination?: { total: number; hasMore: boolean }
    facets?: { categories: Facet[]; stores: Facet[] }
  }

  return {
    items: body.data ?? [],
    total: body.pagination?.total ?? 0,
    hasMore: body.pagination?.hasMore ?? false,
    facets: body.facets,
  }
}

/** Bir ürünün en düşük fiyatı ve kaç markette bulunduğu. */
export function summarizeOffers(offers: ApiOffer[] | undefined) {
  const prices = (offers ?? [])
    .map((o) => Number.parseFloat(o.price))
    .filter((n) => Number.isFinite(n))
  if (prices.length === 0) return null

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return {
    min,
    max,
    storeCount: prices.length,
    // En pahalıya göre yüzde tasarruf. Tek teklif varsa 0 — %0 farkı rozetle
    // süslemek güveni yiyor.
    savingPct: max > 0 ? ((max - min) / max) * 100 : 0,
  }
}
