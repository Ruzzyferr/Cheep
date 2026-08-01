/**
 * Ürünler sayfasının filtre durumu — URL query'sinde yaşar.
 *
 * NEDEN URL'DE: kullanıcı bir filtre kombinasyonunu paylaşabilmeli, geri
 * tuşuna basınca önceki filtreye dönebilmeli ve sayfayı yenilediğinde
 * seçimlerini kaybetmemeli. Bileşen state'inde tutmak üçünü de bozardı.
 *
 * Parametre adları dile göre değil sabit: URL yolu zaten çevriliyor
 * (`/urunler` ↔ `/pl/produkty`), query anahtarlarını da çevirmek paylaşılan
 * linkleri diller arasında kırılgan hale getirirdi.
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export const SORT_OPTIONS = ['relevance', 'price_asc', 'price_desc', 'savings', 'name'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

export interface ProductQueryState {
  search: string
  category: string | null
  stores: string[]
  sort: SortOption
  minPrice: number | null
  maxPrice: number | null
  page: number
}

const KEYS = {
  search: 'ara',
  category: 'kategori',
  stores: 'market',
  sort: 'sirala',
  min: 'min',
  max: 'max',
  page: 'sayfa',
} as const

function parseNumber(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function parseSort(raw: string | null): SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as SortOption)
    : 'relevance'
}

export function useProductQueryState() {
  const [params, setParams] = useSearchParams()

  const state: ProductQueryState = useMemo(
    () => ({
      search: params.get(KEYS.search) ?? '',
      category: params.get(KEYS.category),
      stores: (params.get(KEYS.stores) ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      sort: parseSort(params.get(KEYS.sort)),
      minPrice: parseNumber(params.get(KEYS.min)),
      maxPrice: parseNumber(params.get(KEYS.max)),
      page: Math.max(1, Number(params.get(KEYS.page)) || 1),
    }),
    [params],
  )

  /**
   * Durumu günceller.
   *
   * Sayfa numarası, filtre değişimlerinde OTOMATİK sıfırlanır: 7. sayfadayken
   * kategori değiştiren kullanıcı çoğu zaman boş bir sayfaya düşerdi.
   * `page` açıkça verilirse ona saygı duyulur.
   */
  const update = useCallback(
    (patch: Partial<ProductQueryState>) => {
      const next = new URLSearchParams(params)

      const setOrDelete = (key: string, value: string | null | undefined) => {
        if (value === null || value === undefined || value === '') next.delete(key)
        else next.set(key, value)
      }

      if ('search' in patch) setOrDelete(KEYS.search, patch.search)
      if ('category' in patch) setOrDelete(KEYS.category, patch.category)
      if ('stores' in patch) setOrDelete(KEYS.stores, patch.stores?.join(',') ?? null)
      if ('sort' in patch) {
        // Varsayılan sıralamayı URL'de taşımıyoruz: temiz link paylaşılsın.
        setOrDelete(KEYS.sort, patch.sort === 'relevance' ? null : (patch.sort ?? null))
      }
      if ('minPrice' in patch) setOrDelete(KEYS.min, patch.minPrice?.toString() ?? null)
      if ('maxPrice' in patch) setOrDelete(KEYS.max, patch.maxPrice?.toString() ?? null)

      const changedFilter = ['search', 'category', 'stores', 'sort', 'minPrice', 'maxPrice'].some(
        (k) => k in patch,
      )
      const page = 'page' in patch ? patch.page : changedFilter ? 1 : state.page
      setOrDelete(KEYS.page, page && page > 1 ? String(page) : null)

      setParams(next, { replace: false })
    },
    [params, setParams, state.page],
  )

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: false }), [setParams])

  /** Herhangi bir filtre etkin mi — "filtreleri temizle" düğmesi buna bakar. */
  const hasFilters =
    state.search !== '' ||
    state.category !== null ||
    state.stores.length > 0 ||
    state.minPrice !== null ||
    state.maxPrice !== null

  return { state, update, reset, hasFilters }
}
