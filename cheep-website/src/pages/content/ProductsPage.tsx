import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { SiteLink as Link } from '../../components/ui/SiteLink'
import { LocaleContext } from '../../i18n'
import { CONTENT, fill } from '../../i18n/content'
import { usePageData } from '../../data/context'
import { ContentLayout } from '../../components/content/ContentLayout'
import { CategorySidebar } from '../../components/products/CategorySidebar'
import { FilterBar } from '../../components/products/FilterBar'
import { ProductsSkeleton } from '../../components/products/ProductsSkeleton'
import { ProductsPagination } from '../../components/products/ProductsPagination'
import { SiteDirectory } from '../../components/products/SiteDirectory'
import { formatMoney, formatPct } from '../../lib/money'
import { formatNumber } from '../../lib/format'
import { productPath } from '../../data/routes'
import {
  fetchProducts,
  summarizeOffers,
  type ApiProduct,
  type Facet,
  type ProductsResponse,
} from '../../lib/api'
import { useProductQueryState } from './products/useProductQueryState'
import { cn } from '../../lib/utils'

/** Sayfa başına ürün. Prerender edilen ilk ekranla aynı olmalı. */
const PAGE_SIZE = 40

/**
 * Ürünler sayfası — kataloğun tamamında arama, filtre ve sıralama.
 *
 * NEDEN BÖYLE: sitenin geri kalanı statik üretiliyor, ama filtre
 * kombinasyonlarının tamamını önceden üretmek mümkün değil (15.000+ ürün ×
 * kategori × market × sıralama). Çözüm melez:
 *
 *   - İlk ekran PRERENDER edilir → Googlebot ürünleri HTML'de görür, ziyaretçi
 *     boş sayfa yerine hazır içerik bulur, API çökse bile sayfa anlamlı kalır.
 *   - Kullanıcı bir filtreye dokunduğu an canlı API devreye girer.
 *
 * Eski "Fiyatlar" sayfası bir ürünler sayfası değildi: 67 düz kategori hapı,
 * 6 market kartı ve 49 şehir hapından ibaretti, tek bir ürün göstermiyordu.
 */
export function ProductsPage() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const { country, payload } = usePageData()
  const { state, update, reset, hasFilters } = useProductQueryState()

  // Hook sırası bozulmasın diye erken return YOK; payload uyumsuzsa altta null.
  const initial = payload.kind === 'products' ? payload : null

  /** Prerender edilmiş ilk ekran — API'ye hiç gitmeden gösterilebilir. */
  const initialProducts: ApiProduct[] = useMemo(() => {
    if (!initial) return []
    return initial.products.map((p) => ({
      id: 0,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      image_url: p.image,
      category: p.categorySlug ? { id: 0, name: p.categoryName ?? '', slug: p.categorySlug } : null,
      store_prices: p.offers.map((o) => ({
        price: String(o.price),
        store: { id: 0, name: o.storeName, slug: o.storeSlug },
      })),
    }))
  }, [initial])

  const initialCategories: Facet[] = useMemo(
    () => (initial?.categories ?? []).map((cat) => ({ slug: cat.slug, name: cat.name, n: cat.productCount })),
    [initial],
  )
  const initialStores: Facet[] = useMemo(
    () => (initial?.stores ?? []).map((s) => ({ slug: s.slug, name: s.name, n: s.productCount })),
    [initial],
  )

  // Filtresiz ilk açılışta API'ye hiç gitmeyiz: prerender edilmiş ekran zaten
  // doğru içerik. Kullanıcı bir şeye dokunduğu an canlıya geçeriz.
  const isPristine = !hasFilters && state.page === 1
  const [result, setResult] = useState<ProductsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Mobilde kategori paneli varsayılan KAPALI: açık başlarsa arama ve ürünler
  // yine ekranın altına iner. Masaüstünde `lg:block` her zaman görünür kılar,
  // bu yüzden state yalnızca mobili etkiler (SSR ile de tutarlı).
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (isPristine) {
      setResult(null)
      setFailed(false)
      return
    }

    // Önceki isteği iptal et: kullanıcı yazarken üst üste binen yanıtların
    // eskisi yenisini ezip listeyi yanlış gösterebilirdi.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setFailed(false)

    fetchProducts(
      locale,
      {
        search: state.search || undefined,
        categorySlug: state.category ?? undefined,
        storeSlugs: state.stores,
        sort: state.sort === 'relevance' ? undefined : state.sort,
        minPrice: state.minPrice ?? undefined,
        maxPrice: state.maxPrice ?? undefined,
        page: state.page,
        pageSize: PAGE_SIZE,
        withFacets: true,
      },
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return
        setResult(res)
      })
      .catch((err) => {
        if (controller.signal.aborted || (err as Error).name === 'AbortError') return
        setFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [locale, isPristine, state.search, state.category, state.stores.join(','), state.sort, state.minPrice, state.maxPrice, state.page, attempt])

  useEffect(() => () => abortRef.current?.abort(), [])

  if (!initial) return null

  const products = isPristine ? initialProducts : (result?.items ?? [])
  const total = isPristine ? initial.totals.products : (result?.total ?? 0)
  const categories = result?.facets?.categories ?? initialCategories
  const stores = result?.facets?.stores ?? initialStores
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const toggleStore = (slug: string) => {
    const next = state.stores.includes(slug)
      ? state.stores.filter((s) => s !== slug)
      : [...state.stores, slug]
    update({ stores: next })
  }

  const n = (v: number) => formatNumber(locale, v)
  const selectedCategoryName = categories.find((cat) => cat.slug === state.category)?.name ?? null

  return (
    <ContentLayout
      wide
      crumbs={[
        { label: c.breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
        { label: c.products.title },
      ]}
    >
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{c.products.title}</h1>
        <p className="mt-4 text-lg text-ink-soft">
          {fill(c.products.lead, {
            products: n(initial.totals.products),
            stores: n(initial.totals.stores),
          })}
        </p>
      </header>

      {/*
        Izgara yerleşimi AÇIK: mobilde DOM sırası (filtreler → kategoriler →
        sonuçlar), masaüstünde kategoriler sol sütuna alınır.

        NEDEN: kategori listesi mobilde tüm genişliği kaplayıp aramayı ve
        ürünleri ekranın çok altına itiyordu — kullanıcı sayfayı açtığında 60+
        kategori adından başka bir şey görmüyordu. Tam da bu sayfanın çözmek
        için var olduğu "karışıklık" sorunu.
      */}
      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[16rem_1fr]">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <FilterBar
            search={state.search}
            onSearch={useCallback((value: string) => update({ search: value }), [update])}
            stores={stores}
            selectedStores={state.stores}
            onToggleStore={toggleStore}
            sort={state.sort}
            onSort={(value) => update({ sort: value })}
            minPrice={state.minPrice}
            maxPrice={state.maxPrice}
            onPriceChange={(min, max) => update({ minPrice: min, maxPrice: max })}
            onClear={reset}
            hasFilters={hasFilters}
            locale={locale}
            currency={country.currency}
            labels={{
              searchPlaceholder: c.products.searchPlaceholder,
              stores: c.products.stores,
              sort: c.products.sort,
              sortRelevance: c.products.sortRelevance,
              sortPriceAsc: c.products.sortPriceAsc,
              sortPriceDesc: c.products.sortPriceDesc,
              sortSavings: c.products.sortSavings,
              sortName: c.products.sortName,
              priceRange: c.products.priceRange,
              priceMin: c.products.priceMin,
              priceMax: c.products.priceMax,
              clearFilters: c.products.clearFilters,
            }}
          />
        </div>

        {/* Kategoriler — mobilde katlanır, masaüstünde yapışkan sol sütun */}
        {/*
          data-lenis-prevent ŞART: sitede Lenis smooth-scroll var ve tüm
          tekerlek olaylarını yakalayıp pencere kaydırmasına çeviriyor. Bu
          öznitelik olmadan kullanıcı fareyi kategori listesinin üstüne getirip
          tekerleği çevirdiğinde liste değil SAYFA kayıyordu — uzun kategori
          listesinin altını görmek imkânsızdı.
        */}
        <aside
          data-lenis-prevent
          className="lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto lg:pr-1"
        >
          <button
            type="button"
            onClick={() => setCategoriesOpen((v) => !v)}
            aria-expanded={categoriesOpen}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink lg:hidden"
          >
            <span>
              {c.browse.categories}
              {selectedCategoryName ? `: ${selectedCategoryName}` : ''}
            </span>
            <span aria-hidden className="text-ink-hint">{categoriesOpen ? '−' : '+'}</span>
          </button>

          <h2 className="mb-3 hidden text-sm font-bold uppercase tracking-wide text-ink-hint lg:block">
            {c.browse.categories}
          </h2>

          <div className={cn('mt-3 lg:mt-0', categoriesOpen ? 'block' : 'hidden', 'lg:block')}>
            <CategorySidebar
              categories={categories}
              selected={state.category}
              onSelect={(slug) => {
                update({ category: slug })
                setCategoriesOpen(false)
              }}
              locale={locale}
              labels={{ allCategories: c.products.allCategories }}
            />
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          <p aria-live="polite" className="text-sm text-ink-soft">
            {loading ? c.products.loading : fill(c.products.resultCount, { count: n(total) })}
          </p>

          <div className="mt-4">
            {loading ? (
              <ProductsSkeleton />
            ) : failed ? (
              <div className="rounded-2xl border border-line bg-paper p-10 text-center">
                <p className="text-ink-soft">{c.products.error}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((a) => a + 1)}
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ink px-6 py-3 font-semibold text-cream transition-colors hover:bg-ink/85"
                >
                  {c.products.retry}
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-line bg-paper p-10 text-center">
                <p className="text-ink-soft">{c.products.empty}</p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-4 inline-flex min-h-11 items-center rounded-full border border-ink/15 px-6 py-3 font-semibold text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
                  >
                    {c.products.clearFilters}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {products.map((p, i) => (
                  <ApiProductCard
                    key={p.slug ?? `${p.name}-${i}`}
                    product={p}
                    locale={locale}
                    currency={country.currency}
                    labels={{ from: c.product.from, stores: c.product.stores, save: c.product.save }}
                  />
                ))}
              </div>
            )}
          </div>

          {!loading && !failed && totalPages > 1 && (
            <ProductsPagination
              current={state.page}
              total={totalPages}
              onNavigate={(page) => update({ page })}
              labels={c.pagination}
            />
          )}

          {/*
            Dizin: kategori/market/şehir SAYFALARINA gerçek bağlantılar.
            Soldaki liste filtre düğmesi (aynı sayfada kalır), burası ayrı
            sayfalara gider. Bu görev eskiden /fiyatlar'daydı; o sayfa
            kaldırıldı ama 7.665 içerik sayfasının iç bağlantısı kaldırılamazdı.
          */}
          <SiteDirectory
            categories={initial.categories}
            stores={initial.stores}
            cities={initial.cities}
            locale={locale}
            labels={{
              title: c.products.directoryTitle,
              categories: c.browse.categories,
              stores: c.browse.stores,
              cities: c.browse.cities,
            }}
          />
        </div>
      </div>
    </ContentLayout>
  )
}

/**
 * Canlı API'den gelen ürün için kart.
 *
 * `components/price/ProductCard` statik payload şeklini bekliyor; iki farklı
 * veri kaynağını tek bileşene sıkıştırmak yerine burada ince bir uyarlama
 * yapıyoruz. Görsel dil aynı.
 */
function ApiProductCard({
  product,
  locale,
  currency,
  labels,
}: {
  product: ApiProduct
  locale: 'tr' | 'pl'
  currency: string
  labels: { from: string; stores: string; save: string }
}) {
  const summary = summarizeOffers(product.store_prices)
  if (!summary) return null

  const showSaving = summary.savingPct >= 1
  const inner = (
    <>
      <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-cream-deep">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt=""
            loading="lazy"
            width={112}
            height={112}
            className="h-28 w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // Kırık <img> bırakmıyoruz; görselsiz ürün nötr bir işaret alır.
          <span aria-hidden="true" className="font-display text-3xl text-ink-hint">
            {(product.brand || product.name).charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{product.name}</h3>

      <div className="mt-auto pt-3">
        <p className="text-xs text-ink-hint">{labels.from}</p>
        <p className="text-lg font-bold tabular-nums text-ink">
          {formatMoney(locale, currency, summary.min)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-ink-soft">
            {summary.storeCount} {labels.stores}
          </span>
          {showSaving && (
            <span className="rounded-full bg-mint-soft px-2 py-0.5 font-semibold text-mint-deep">
              {labels.save} {formatPct(locale, summary.savingPct)}
            </span>
          )}
        </div>
      </div>
    </>
  )

  const cardClass =
    'group flex flex-col rounded-2xl border border-line bg-paper p-4 transition-all hover:-translate-y-0.5 hover:border-clementine/40 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clementine'

  // Slug'ı olmayan ürünün kendi sayfası yok (yayın eşiğini geçmemiş);
  // tıklanamaz kart olarak gösteririz, kırık link vermeyiz.
  return product.slug ? (
    <Link to={productPath(locale, product.slug)} className={cardClass}>
      {inner}
    </Link>
  ) : (
    <div className={cardClass}>{inner}</div>
  )
}
