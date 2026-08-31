import { useContext } from 'react'
import { SiteLink as Link } from '../../components/ui/SiteLink'
import { LocaleContext } from '../../i18n'
import { CONTENT, fill } from '../../i18n/content'
import { usePageData } from '../../data/context'
import { summarize } from '../../data/types'
import { ContentLayout } from '../../components/content/ContentLayout'
import { PriceTable } from '../../components/price/PriceTable'
import { Sparkline } from '../../components/price/Sparkline'
import { ProductCard } from '../../components/price/ProductCard'
import { formatAge, formatMoney, formatPct } from '../../lib/money'
import { categoryPath } from '../../data/routes'
import { StoreBadges } from '../../components/ui/StoreBadges'

/**
 * Ürün karşılaştırma sayfası — sitedeki 6.471 sayfanın şablonu ve
 * organik trafiğin ana kapısı.
 */
export function ProductPage() {
  const locale = useContext(LocaleContext)
  const t = CONTENT[locale].product
  const { country, payload } = usePageData()
  if (payload.kind !== 'product') return null

  const { product, similar } = payload
  const s = summarize(product.offers)
  // Üretim zamanı sabit: `new Date()` çağırmak prerender ile istemci arasında
  // farklı sonuç verir ve hydration'ı düşürür.
  const now = new Date(country.generatedAt)

  const crumbs = [
    { label: CONTENT[locale].breadcrumbHome, href: locale === 'tr' ? '/' : '/pl' },
    ...(product.categorySlug && product.categoryName
      ? [{ label: product.categoryName, href: categoryPath(locale, product.categorySlug) }]
      : []),
    { label: product.name },
  ]

  if (!s) {
    return (
      <ContentLayout crumbs={crumbs}>
        <h1 className="text-3xl font-bold text-ink">{product.name}</h1>
        <p className="mt-4 text-ink-soft">{t.noOffers}</p>
      </ContentLayout>
    )
  }

  const money = (v: number) => formatMoney(locale, country.currency, v)

  return (
    <ContentLayout crumbs={crumbs}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* --- görsel + özet --- */}
        <div>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-line bg-paper p-8">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                width={320}
                height={320}
                className="h-full w-full object-contain"
              />
            ) : (
              <span aria-hidden="true" className="font-display text-6xl text-ink-hint">
                {(product.brand || product.name).charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {product.history.length >= 2 && (
            <div className="mt-6 rounded-2xl border border-line bg-paper p-5">
              <p className="eyebrow mb-3 text-clementine-deep">{t.trend}</p>
              <Sparkline
                history={product.history}
                label={fill(t.trendLabel, { name: product.name })}
              />
            </div>
          )}
        </div>

        {/* --- başlık, tasarruf, tablo --- */}
        <div>
          {product.brand && <p className="eyebrow mb-2 text-clementine-deep">{product.brand}</p>}
          <h1 className="text-3xl font-bold leading-tight text-ink md:text-4xl">{product.name}</h1>

          <div className="mt-6 rounded-2xl bg-mint-soft p-5">
            <p className="text-lg font-semibold text-mint-deep">
              {s.savingPct >= 1
                ? fill(t.savingHeadline, {
                    store: s.cheapest.storeName,
                    pct: formatPct(locale, s.savingPct),
                    abs: money(s.savingAbs),
                  })
                : fill(t.savingNone, { count: s.storeCount })}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {fill(t.availability, { count: s.storeCount })} ·{' '}
              {formatAge(locale, s.updatedAt, now)}
            </p>
          </div>

          <div className="mt-8">
            <PriceTable
              offers={product.offers}
              locale={locale}
              currency={country.currency}
              now={now}
              labels={{
                store: t.store,
                price: t.price,
                updated: t.updated,
                cheapest: t.cheapest,
                caption: t.priceTableCaption,
              }}
            />
          </div>

          {/* İKİ MAĞAZA DA BURADA OLMALI.
              Burası sitenin organik trafiğinin ana kapısı: 5.800'den fazla
              ürün sayfasının her birinde tek indirme çağrısı vardı ve o da
              yalnızca Google Play'e gidiyordu. iOS beş mağazada yayına
              girdikten sonra bile öyle kaldı — yani arama sonucundan gelen
              her iPhone kullanıcısı, uygulama kendi mağazasında dururken
              indirecek bir yer bulamıyordu. */}
          <div className="mt-8 rounded-2xl border border-clementine/30 bg-paper p-6">
            <h2 className="text-lg font-bold text-ink">{t.cta}</h2>
            <p className="mt-2 text-sm text-ink-soft">{t.ctaBody}</p>
            <StoreBadges className="mt-4 [--rozet-h:40px] md:[--rozet-h:44px]" />
          </div>
        </div>
      </div>

      {/* --- SSS: hem kullanıcı hem FAQPage yapılandırılmış verisi --- */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold text-ink">{t.faqTitle}</h2>
        <dl className="mt-6 space-y-6">
          <div>
            <dt className="font-semibold text-ink">{fill(t.q1, { name: product.name })}</dt>
            <dd className="mt-2 text-ink-soft">
              {fill(t.a1, {
                store: s.cheapest.storeName,
                price: money(s.min),
                date: formatAge(locale, s.cheapest.updatedAt, now),
              })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">{fill(t.q2, { name: product.name })}</dt>
            <dd className="mt-2 text-ink-soft">
              {fill(t.a2, {
                min: money(s.min),
                max: money(s.max),
                abs: money(s.savingAbs),
                pct: formatPct(locale, s.savingPct),
              })}
            </dd>
          </div>
        </dl>
      </section>

      {/* --- iç bağlantı ağı: taranabilirlik ve otorite dağıtımı --- */}
      {similar.length > 0 && (
        <section className="mt-16">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold text-ink">{t.similar}</h2>
            {product.categorySlug && product.categoryName && (
              <Link
                to={categoryPath(locale, product.categorySlug)}
                className="inline-flex min-h-11 items-center py-2 text-sm font-semibold text-clementine-deep hover:underline"
              >
                {product.categoryName} →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {similar.map((p) => (
              <ProductCard
                key={p.slug}
                product={p}
                locale={locale}
                currency={country.currency}
                labels={{ from: t.from, stores: t.stores, save: t.save }}
              />
            ))}
          </div>
        </section>
      )}
    </ContentLayout>
  )
}
