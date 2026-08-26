import { useEffect, useState } from 'react'
import type { Facet } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import type { Locale } from '../../i18n'
import { cn } from '../../lib/utils'
import { SORT_OPTIONS, type SortOption } from '../../pages/content/products/useProductQueryState'

export interface FilterLabels {
  searchPlaceholder: string
  stores: string
  sort: string
  sortRelevance: string
  sortPriceAsc: string
  sortPriceDesc: string
  sortSavings: string
  sortName: string
  priceRange: string
  priceMin: string
  priceMax: string
  clearFilters: string
}

/**
 * Arama, market çipleri, sıralama ve fiyat aralığı.
 *
 * Arama kutusu YEREL state tutar ve gecikmeli (debounce) olarak URL'e yazar:
 * her tuş vuruşunda URL değiştirmek tarayıcı geçmişini çöpe çevirir ve geri
 * tuşunu kullanılamaz hale getirir.
 */
export function FilterBar({
  search,
  onSearch,
  stores,
  selectedStores,
  onToggleStore,
  sort,
  onSort,
  minPrice,
  maxPrice,
  onPriceChange,
  onClear,
  hasFilters,
  locale,
  labels,
  currency,
}: {
  search: string
  onSearch: (value: string) => void
  stores: Facet[]
  selectedStores: string[]
  onToggleStore: (slug: string) => void
  sort: SortOption
  onSort: (value: SortOption) => void
  minPrice: number | null
  maxPrice: number | null
  onPriceChange: (min: number | null, max: number | null) => void
  onClear: () => void
  hasFilters: boolean
  locale: Locale
  labels: FilterLabels
  currency: string
}) {
  const [term, setTerm] = useState(search)
  const [localMin, setLocalMin] = useState(minPrice?.toString() ?? '')
  const [localMax, setLocalMax] = useState(maxPrice?.toString() ?? '')

  // URL dışarıdan değişirse (geri tuşu, "filtreleri temizle") kutuları eşitle.
  //
  // Bu eskiden üç `useEffect(() => setX(prop), [prop])` idi. React'in kendi
  // belgeleri bunu açıkça anti-desen sayıyor: efekt önce ESKİ değerle bir
  // render'ı ekrana basıyor, sonra state'i düzeltip ikinci bir render
  // tetikliyor — geri tuşuna basınca kutuda bir kare boyunca eski metin
  // kalıyordu. Doğrusu değişimi RENDER SIRASINDA yakalamak; React bunu özel
  // olarak ele alıp ekrana hiç basmadan yeniden render ediyor.
  //
  // ÜÇÜ AYRI TUTULUYOR — bilerek. Tek bir birleşik anahtar kullanılsaydı
  // fiyat kutusuna dokunmak, kullanıcının O SIRADA YAZDIĞI arama metnini de
  // sıfırlardı (arama 350 ms geciktirmeli, yani yazarken `search` prop'u
  // henüz güncellenmemiş oluyor).
  const [oncekiSearch, setOncekiSearch] = useState(search)
  if (search !== oncekiSearch) {
    setOncekiSearch(search)
    setTerm(search)
  }

  const [oncekiMin, setOncekiMin] = useState(minPrice)
  if (minPrice !== oncekiMin) {
    setOncekiMin(minPrice)
    setLocalMin(minPrice?.toString() ?? '')
  }

  const [oncekiMax, setOncekiMax] = useState(maxPrice)
  if (maxPrice !== oncekiMax) {
    setOncekiMax(maxPrice)
    setLocalMax(maxPrice?.toString() ?? '')
  }

  // Yazmayı bitirmesini bekle: her tuşta URL yazmak geçmişi çöpe çevirir.
  useEffect(() => {
    if (term === search) return
    const id = setTimeout(() => onSearch(term), 350)
    return () => clearTimeout(id)
  }, [term, search, onSearch])

  const sortLabels: Record<SortOption, string> = {
    relevance: labels.sortRelevance,
    price_asc: labels.sortPriceAsc,
    price_desc: labels.sortPriceDesc,
    savings: labels.sortSavings,
    name: labels.sortName,
  }

  const commitPrice = () => {
    const parse = (v: string) => {
      const n = Number(v)
      return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null
    }
    onPriceChange(parse(localMin), parse(localMax))
  }

  const n = (v: number) => formatNumber(locale, v)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{labels.searchPlaceholder}</span>
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="min-h-11 w-full rounded-full border border-line bg-paper px-5 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-hint focus:border-clementine"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <span className="shrink-0">{labels.sort}</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortOption)}
            className="min-h-11 rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink outline-none focus:border-clementine"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {sortLabels[opt]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {stores.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-hint">
            {labels.stores}
          </span>
          {stores.map((store) => {
            const active = selectedStores.includes(store.slug)
            return (
              <button
                key={store.slug}
                type="button"
                onClick={() => onToggleStore(store.slug)}
                aria-pressed={active}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'border-clementine bg-clementine/10 font-semibold text-clementine-deep'
                    : 'border-line bg-paper text-ink-soft hover:border-clementine/40',
                )}
              >
                {store.name}
                <span className="tabular-nums text-xs text-ink-hint">{n(store.n)}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-hint">
          {labels.priceRange}
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={(e) => e.key === 'Enter' && commitPrice()}
          placeholder={labels.priceMin}
          aria-label={`${labels.priceRange} — ${labels.priceMin}`}
          className="min-h-9 w-24 rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink outline-none focus:border-clementine"
        />
        <span aria-hidden className="text-ink-hint">–</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={localMax}
          onChange={(e) => setLocalMax(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={(e) => e.key === 'Enter' && commitPrice()}
          placeholder={labels.priceMax}
          aria-label={`${labels.priceRange} — ${labels.priceMax}`}
          className="min-h-9 w-24 rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink outline-none focus:border-clementine"
        />
        <span className="text-xs text-ink-hint">{currency}</span>

        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto inline-flex min-h-9 items-center rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-clementine hover:text-clementine-deep"
          >
            {labels.clearFilters}
          </button>
        )}
      </div>
    </div>
  )
}
