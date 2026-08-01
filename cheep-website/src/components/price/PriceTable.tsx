import type { Locale } from '../../i18n'
import type { Offer } from '../../data/types'
import { formatAge, formatMoney } from '../../lib/money'

/**
 * Ürünün marketlere göre fiyat tablosu — sayfanın var oluş sebebi.
 *
 * Gerçek `<table>` kullanıyor: ekran okuyucular için doğru yapı ve üç kolon
 * 390 px'e rahat sığıyor, yani mobilde kart yığınına çevirmeye gerek yok
 * (çevirmek erişilebilirliği bozmadan yapmayı zorlaştırırdı).
 *
 * Fiyatlar `tabular-nums` ile hizalı: basamakları kaymayan tablo pahalı,
 * kayan tablo amatör görünür.
 */
export function PriceTable({
  offers,
  locale,
  currency,
  now,
  labels,
}: {
  offers: Offer[]
  locale: Locale
  currency: string
  now: Date
  labels: { store: string; price: string; updated: string; cheapest: string; caption: string }
}) {
  const sorted = [...offers].sort((a, b) => a.price - b.price)
  const cheapestPrice = sorted[0]?.price

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{labels.caption}</caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="py-3 pr-4 text-sm font-semibold text-ink-soft">
            {labels.store}
          </th>
          <th scope="col" className="py-3 pr-4 text-right text-sm font-semibold text-ink-soft">
            {labels.price}
          </th>
          <th scope="col" className="py-3 text-right text-sm font-semibold text-ink-soft">
            {labels.updated}
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((offer) => {
          const isCheapest = offer.price === cheapestPrice
          return (
            <tr
              key={offer.storeSlug}
              className={`border-b border-line/60 ${isCheapest ? 'bg-mint-soft' : ''}`}
            >
              <th scope="row" className="py-4 pr-4 font-medium text-ink">
                {offer.storeName}
                {/* Renk tek başına anlam taşımamalı — "en ucuz" metinle de yazılı. */}
                {isCheapest && (
                  <span className="ml-2 inline-block rounded-full bg-mint-deep px-2 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-white">
                    {labels.cheapest}
                  </span>
                )}
              </th>
              <td
                className={`py-4 pr-4 text-right tabular-nums ${
                  isCheapest ? 'text-lg font-bold text-mint-deep' : 'text-ink'
                }`}
              >
                {formatMoney(locale, currency, offer.price)}
              </td>
              <td className="py-4 text-right text-sm text-ink-hint">
                {formatAge(locale, offer.updatedAt, now)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
