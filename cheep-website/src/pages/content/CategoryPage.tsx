import { useContext } from 'react'
import { SiteLink as Link } from '../../components/ui/SiteLink'
import { LocaleContext } from '../../i18n'
import { CONTENT, fill, fillLocalized } from '../../i18n/content'
import { usePageData } from '../../data/context'
import { ContentLayout } from '../../components/content/ContentLayout'
import { ProductGrid } from '../../components/price/ProductGrid'
import { Pagination } from '../../components/price/Pagination'
import { categoryPath, storeCategoryPath } from '../../data/routes'

/** Kategori listesi — 202 sayfa, iç bağlantı ağının omurgası. */
export function CategoryPage() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const { country, payload } = usePageData()
  if (payload.kind !== 'category') return null

  const { category, products, page, totalPages, stores } = payload

  return (
    <ContentLayout
      crumbs={[
        { label: c.breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
        { label: category.name },
      ]}
    >
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{category.name}</h1>
        <p className="mt-4 text-lg text-ink-soft">
          {fillLocalized(locale, c.category.intro, {
            name: category.name,
            count: category.productCount,
            stores: stores.length,
          })}
        </p>
      </header>

      {products.length === 0 ? (
        <p className="mt-12 text-ink-soft">{c.category.empty}</p>
      ) : (
        <>
          <div className="mt-10">
            <ProductGrid
              products={products}
              locale={locale}
              currency={country.currency}
              labels={{ from: c.product.from, stores: c.product.stores, save: c.product.save }}
            />
          </div>

          <Pagination
            current={page}
            total={totalPages}
            hrefFor={(p) => categoryPath(locale, category.slug, p)}
            labels={c.pagination}
          />
        </>
      )}

      {/* Market kırılımı: hem kullanıcıya daralt seçeneği hem 831 sayfaya bağlantı */}
      {stores.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-ink">
            {fill(c.category.byStore, { name: category.name })}
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {stores.map((s) => (
              <Link
                key={s.slug}
                to={storeCategoryPath(locale, s.slug, category.slug)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </ContentLayout>
  )
}
