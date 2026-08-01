import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { LocaleContext } from '../../i18n'
import { CONTENT, fill } from '../../i18n/content'
import { usePageData } from '../../data/context'
import { ContentLayout } from '../../components/content/ContentLayout'
import { formatNumber } from '../../lib/format'
import { categoryPath, cityPath, storePath, reportPath, comparePath, productsPath } from '../../data/routes'

/**
 * Keşif sayfası — sitedeki her şeye açılan kapı.
 *
 * NEDEN VAR: 7.600 sayfa üretilmişti ama anasayfadan hiçbirine görünür bir
 * yol yoktu; kullanıcı ancak anasayfadaki 6 ürün kartının kategorisine
 * tıklayıp dolambaçlı şekilde ulaşabiliyordu. Ürünün sahibi bile bulamadı.
 *
 * SEO tarafında da gerekliydi: Google sayfaları sitemap'ten keşfeder ama
 * otoriteyi İÇ BAĞLANTILAR üzerinden dağıtır. Hiçbir sayfadan bağlantı
 * almayan bir sayfa "öksüz" sayılır ve daha az değer görür. Burası kategori,
 * market ve şehir sayfalarının tamamına tek tık uzaklıktan bağlanıyor.
 */
export function BrowsePage() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const { payload } = usePageData()
  if (payload.kind !== 'browse') return null

  const { categories, stores, cities, totals } = payload
  const n = (v: number) => formatNumber(locale, v)

  return (
    <ContentLayout
      crumbs={[
        { label: c.breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
        { label: c.browse.title },
      ]}
    >
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{c.browse.title}</h1>
        <p className="mt-4 text-lg text-ink-soft">
          {fill(c.browse.lead, { products: n(totals.products), stores: n(stores.length), branches: n(totals.branches) })}
        </p>
      </header>

      {/* Öne çıkan hub'lar. Ürünler sayfası başta: kullanıcı buraya kategori
          hapı aramaya değil ÜRÜN aramaya geliyor. */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={productsPath(locale)}
          className="inline-flex min-h-11 items-center rounded-full bg-clementine-deep px-6 py-3 font-semibold text-white transition-colors hover:bg-clementine-deep/85"
        >
          {c.products.title} →
        </Link>
        <Link
          to={reportPath(locale)}
          className="inline-flex min-h-11 items-center rounded-full bg-ink px-6 py-3 font-semibold text-cream transition-colors hover:bg-ink/85"
        >
          {c.report.title} →
        </Link>
        <Link
          to={comparePath(locale)}
          className="inline-flex min-h-11 items-center rounded-full border border-ink/15 px-6 py-3 font-semibold text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
        >
          {c.compare.title} →
        </Link>
      </div>

      <Section title={c.browse.categories}>
        <div className="flex flex-wrap gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={categoryPath(locale, cat.slug)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
            >
              {cat.name}
              <span className="tabular-nums text-ink-hint">{n(cat.productCount)}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title={c.browse.stores}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <Link
              key={s.slug}
              to={storePath(locale, s.slug)}
              className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-line bg-paper px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-clementine/40 hover:shadow-lg"
            >
              <span className="font-semibold text-ink">{s.name}</span>
              <span className="text-right text-xs tabular-nums text-ink-soft">
                {n(s.productCount)} {c.store.products}
                <br />
                {n(s.branchCount)} {c.store.branches}
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title={c.browse.cities}>
        <div className="flex flex-wrap gap-2">
          {cities.map((city) => (
            <Link
              key={city.slug}
              to={cityPath(locale, city.slug)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-paper px-4 py-2.5 text-sm text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </Section>
    </ContentLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="mb-5 text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}
