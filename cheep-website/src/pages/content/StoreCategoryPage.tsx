import { useContext } from 'react'
import { LocaleContext } from '../../i18n'
import { CONTENT, fillLocalized } from '../../i18n/content'
import { usePageData } from '../../data/context'
import { ContentLayout } from '../../components/content/ContentLayout'
import { ProductGrid } from '../../components/price/ProductGrid'
import { categoryPath, storePath } from '../../data/routes'

/**
 * Market × kategori — 831 sayfa ve en değerli uzun kuyruk yüzeyi.
 * "BİM süt fiyatları", "Biedronka nabiał ceny" tipi sorguların hedefi.
 */
export function StoreCategoryPage() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const { country, payload } = usePageData()
  if (payload.kind !== 'storeCategory') return null

  const { store, category, products } = payload
  const title = `${store.name} — ${category.name}`

  return (
    <ContentLayout
      crumbs={[
        { label: c.breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
        { label: store.name, href: storePath(locale, store.slug) },
        { label: category.name },
      ]}
    >
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{title}</h1>
        <p className="mt-4 text-lg text-ink-soft">
          {fillLocalized(locale, c.category.introSingle, { name: category.name, count: products.length })}
        </p>
      </header>

      {products.length === 0 ? (
        <p className="mt-12 text-ink-soft">{c.category.empty}</p>
      ) : (
        <div className="mt-10">
          <ProductGrid
            products={products}
            locale={locale}
            currency={country.currency}
            labels={{ from: c.product.from, stores: c.product.stores, save: c.product.save }}
          />
        </div>
      )}

      <div className="mt-14 flex flex-wrap gap-6">
        <a href={categoryPath(locale, category.slug)} className="inline-flex min-h-11 items-center py-2 font-semibold text-clementine-deep hover:underline">
          {category.name} →
        </a>
        <a href={storePath(locale, store.slug)} className="inline-flex min-h-11 items-center py-2 font-semibold text-clementine-deep hover:underline">
          {store.name} →
        </a>
      </div>
    </ContentLayout>
  )
}
