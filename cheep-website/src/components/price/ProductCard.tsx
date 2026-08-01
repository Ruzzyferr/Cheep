import { SiteLink as Link } from '../ui/SiteLink'
import type { Locale } from '../../i18n'
import type { Product } from '../../data/types'
import { summarize } from '../../data/types'
import { formatMoney, formatPct } from '../../lib/money'
import { productPath } from '../../data/routes'

/**
 * Izgaralardaki ürün kartı. Kategori, market ve şehir sayfaları bunu kullanır.
 *
 * Karttaki tek "satış" mesajı tasarruf rozeti: kaç para kazandığını görmeyen
 * kullanıcı tıklamaz. Rozet yalnızca gerçek bir fark varsa çıkıyor — %0 farkı
 * rozetle süslemek güveni yiyor.
 */
export function ProductCard({
  product,
  locale,
  currency,
  labels,
}: {
  product: Product
  locale: Locale
  currency: string
  labels: { from: string; stores: string; save: string }
}) {
  const s = summarize(product.offers)
  if (!s) return null

  const showSaving = s.savingPct >= 1

  return (
    <Link
      to={productPath(locale, product.slug)}
      className="group flex flex-col rounded-2xl border border-line bg-paper p-4 transition-all hover:-translate-y-0.5 hover:border-clementine/40 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clementine"
    >
      <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-cream-deep">
        {product.image ? (
          <img
            src={product.image}
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
          {formatMoney(locale, currency, s.min)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-ink-soft">
            {s.storeCount} {labels.stores}
          </span>
          {showSaving && (
            <span className="rounded-full bg-mint-soft px-2 py-0.5 font-semibold text-mint-deep">
              {labels.save} {formatPct(locale, s.savingPct)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
