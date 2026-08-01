import { useContext } from 'react'
import { SiteLink as Link } from '../../components/ui/SiteLink'
import { LocaleContext } from '../../i18n'
import { CONTENT, fill } from '../../i18n/content'
import { usePageData } from '../../data/context'
import { ContentLayout } from '../../components/content/ContentLayout'
import { formatNumber } from '../../lib/format'
import { storePath, comparePath } from '../../data/routes'

/**
 * Şehir sayfası — 286 sayfa, yerel arama niyetini yakalar
 * ("Ankara en ucuz market", "sklepy w Krakowie").
 */
export function CityPage() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const { payload } = usePageData()
  if (payload.kind !== 'city') return null

  const { city } = payload
  const n = (v: number) => formatNumber(locale, v)

  return (
    <ContentLayout
      crumbs={[
        { label: c.breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
        { label: city.name },
      ]}
    >
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{city.name}</h1>
        <p className="mt-4 text-lg text-ink-soft">
          {fill(c.city.intro, { name: city.name, branches: n(city.branchCount) })}
        </p>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl border border-line bg-paper p-5">
          <dt className="text-xs uppercase tracking-wide text-ink-hint">{c.city.branches}</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{n(city.branchCount)}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-5">
          <dt className="text-xs uppercase tracking-wide text-ink-hint">{c.city.stores}</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{n(city.stores.length)}</dd>
        </div>
      </dl>

      <section className="mt-14">
        <h2 className="text-xl font-bold text-ink">{c.city.chains}</h2>
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-paper">
          {city.stores.map((s) => (
            <li key={s.slug}>
              <Link
                to={storePath(locale, s.slug)}
                className="flex min-h-14 items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-cream-deep"
              >
                <span className="font-medium text-ink">{s.name}</span>
                <span className="tabular-nums text-sm text-ink-soft">
                  {n(s.branchCount)} {c.city.branches}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-14">
        <Link to={comparePath(locale)} className="inline-flex min-h-11 items-center py-2 font-semibold text-clementine-deep hover:underline">
          {c.compare.title} →
        </Link>
      </div>
    </ContentLayout>
  )
}
