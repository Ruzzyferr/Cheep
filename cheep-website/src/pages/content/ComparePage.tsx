import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { LocaleContext } from '../../i18n'
import { CONTENT } from '../../i18n/content'
import { usePageData } from '../../data/context'
import { ContentLayout } from '../../components/content/ContentLayout'
import { formatNumber } from '../../lib/format'
import { storePath } from '../../data/routes'

/**
 * "En ucuz market hangisi?" — yüksek niyetli bir sorgu ve dürüst cevabı
 * olan bir sayfa: hangi market kaç üründe en ucuz, veriden sayılmış.
 */
export function ComparePage() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const { payload } = usePageData()
  if (payload.kind !== 'compare') return null

  const { stores, cheapestCounts } = payload
  const n = (v: number) => formatNumber(locale, v)
  const ranked = [...stores].sort((a, b) => (cheapestCounts[b.slug] ?? 0) - (cheapestCounts[a.slug] ?? 0))

  return (
    <ContentLayout
      crumbs={[
        { label: c.breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
        { label: c.compare.title },
      ]}
    >
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{c.compare.title}</h1>
        <p className="mt-4 text-lg text-ink-soft">{c.compare.lead}</p>
      </header>

      {/* Dört kolon 390px'e sığmıyor; yalnızca tablo kaydırılabilir, sayfa gövdesi değil. */}
      <div className="mt-10 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <caption className="sr-only">{c.compare.table}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-4 text-sm font-semibold text-ink-soft">
                {c.compare.store}
              </th>
              <th scope="col" className="px-5 py-4 text-right text-sm font-semibold text-ink-soft">
                {c.compare.cheapestCount}
              </th>
              <th scope="col" className="px-5 py-4 text-right text-sm font-semibold text-ink-soft">
                {c.compare.products}
              </th>
              <th scope="col" className="px-5 py-4 text-right text-sm font-semibold text-ink-soft">
                {c.compare.branches}
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s, i) => (
              <tr key={s.slug} className={`border-b border-line/60 ${i === 0 ? 'bg-mint-soft' : ''}`}>
                <th scope="row" className="px-5 py-4 font-medium text-ink">
                  <Link to={storePath(locale, s.slug)} className="inline-flex min-h-6 items-center py-1 hover:text-clementine-deep hover:underline">
                    {s.name}
                  </Link>
                </th>
                <td className="px-5 py-4 text-right font-bold tabular-nums text-ink">
                  {n(cheapestCounts[s.slug] ?? 0)}
                </td>
                <td className="px-5 py-4 text-right tabular-nums text-ink-soft">{n(s.productCount)}</td>
                <td className="px-5 py-4 text-right tabular-nums text-ink-soft">{n(s.branchCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ContentLayout>
  )
}
