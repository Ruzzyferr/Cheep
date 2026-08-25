import { useContext } from 'react'
import { SiteLink as Link } from '../../components/ui/SiteLink'
import { LocaleContext } from '../../i18n'
import { CONTENT, fillLocalized } from '../../i18n/content'
import { usePageData } from '../../data/context'
import { ContentLayout } from '../../components/content/ContentLayout'
import { ProductGrid } from '../../components/price/ProductGrid'
import { formatNumber } from '../../lib/format'
import { storeCategoryPath, comparePath } from '../../data/routes'

/** Market profili — 11 sayfa ama kategori kırılımıyla 831 sayfaya dağıtım noktası. */
export function StorePage() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const { country, payload } = usePageData()
  if (payload.kind !== 'store') return null

  const { store, categories, topProducts } = payload
  const n = (v: number) => formatNumber(locale, v)

  return (
    <ContentLayout
      crumbs={[
        { label: c.breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
        { label: store.name },
      ]}
    >
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{store.name}</h1>
        <p className="mt-4 text-lg text-ink-soft">
          {fillLocalized(locale, c.store.intro, {
            name: store.name,
            products: n(store.productCount),
            branches: n(store.branchCount),
            cities: n(store.cityCount),
          })}
        </p>
      </header>

      <dl className="mt-8 grid grid-cols-3 gap-4">
        {[
          { label: c.store.products, value: store.productCount },
          { label: c.store.branches, value: store.branchCount },
          { label: c.store.cities, value: store.cityCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-paper p-5">
            <dt className="text-xs uppercase tracking-wide text-ink-hint">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{n(stat.value)}</dd>
          </div>
        ))}
      </dl>

      {categories.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-ink">{c.store.categories}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                to={storeCategoryPath(locale, store.slug, cat.slug)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
              >
                {cat.name}
                <span className="ml-2 tabular-nums text-ink-hint">{n(cat.productCount)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {topProducts.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 text-xl font-bold text-ink">{c.store.topDrops}</h2>
          <ProductGrid
            products={topProducts}
            locale={locale}
            currency={country.currency}
            labels={{ from: c.product.from, stores: c.product.stores, save: c.product.save }}
          />
        </section>
      )}

      <div className="mt-14">
        <Link to={comparePath(locale)} className="inline-flex min-h-11 items-center py-2 font-semibold text-clementine-deep hover:underline">
          {c.compare.title} →
        </Link>
      </div>
    </ContentLayout>
  )
}
