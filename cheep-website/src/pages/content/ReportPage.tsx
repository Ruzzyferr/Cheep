import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { LocaleContext } from '../../i18n'
import { CONTENT } from '../../i18n/content'
import { usePageData } from '../../data/context'
import type { Product } from '../../data/types'
import { summarize } from '../../data/types'
import { ContentLayout } from '../../components/content/ContentLayout'
import { formatMoney, formatPct } from '../../lib/money'
import { productPath } from '../../data/routes'

/**
 * Zam raporu — sitedeki en "haber değeri" taşıyan sayfa.
 *
 * Doğal bağlantı alma ihtimali en yüksek sayfa bu: fiyat artışı herkesin
 * konuştuğu bir şey ve elimizde gerçek veri var. Fiyat geçmişi derinleştikçe
 * (bugün 28 gün) daha da güçlenecek.
 */
export function ReportPage() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const { country, payload } = usePageData()
  if (payload.kind !== 'report') return null

  const { risers, fallers } = payload
  const hasData = risers.length > 0 || fallers.length > 0

  return (
    <ContentLayout
      crumbs={[
        { label: c.breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
        { label: c.report.title },
      ]}
    >
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{c.report.title}</h1>
        <p className="mt-4 text-lg text-ink-soft">{c.report.lead}</p>
      </header>

      {!hasData ? (
        <p className="mt-12 text-ink-soft">{c.report.noData}</p>
      ) : (
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <ChangeList
            title={c.report.risers}
            items={risers}
            tone="up"
            locale={locale}
            currency={country.currency}
            changeLabel={c.report.change}
          />
          <ChangeList
            title={c.report.fallers}
            items={fallers}
            tone="down"
            locale={locale}
            currency={country.currency}
            changeLabel={c.report.change}
          />
        </div>
      )}
    </ContentLayout>
  )
}

function ChangeList({
  title,
  items,
  tone,
  locale,
  currency,
  changeLabel,
}: {
  title: string
  items: { product: Product; changePct: number }[]
  tone: 'up' | 'down'
  locale: 'tr' | 'pl'
  currency: string
  changeLabel: string
}) {
  if (items.length === 0) return null
  // Yeşil düşüş, turuncu artış — sitedeki tek renk kodlaması.
  const color = tone === 'up' ? 'text-clementine-deep' : 'text-mint-deep'
  const bg = tone === 'up' ? 'bg-clementine/10' : 'bg-mint-soft'

  return (
    <section>
      <h2 className="mb-5 text-xl font-bold text-ink">{title}</h2>
      <ol className="divide-y divide-line rounded-2xl border border-line bg-paper">
        {items.map(({ product, changePct }) => {
          const s = summarize(product.offers)
          return (
            <li key={product.slug}>
              <Link
                to={productPath(locale, product.slug)}
                className="flex min-h-16 items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-cream-deep"
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-medium text-ink">{product.name}</span>
                  {s && (
                    <span className="mt-0.5 block text-xs tabular-nums text-ink-hint">
                      {formatMoney(locale, currency, s.min)}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 rounded-full ${bg} px-3 py-1 text-sm font-bold tabular-nums ${color}`}
                  aria-label={changeLabel}
                >
                  {tone === 'up' ? '+' : '−'}
                  {formatPct(locale, Math.abs(changePct))}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
