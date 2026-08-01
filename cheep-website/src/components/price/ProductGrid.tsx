import type { Locale } from '../../i18n'
import type { Product } from '../../data/types'
import { ProductCard } from './ProductCard'

/** Kategori, market ve şehir sayfalarının ortak ürün ızgarası. */
export function ProductGrid({
  products,
  locale,
  currency,
  labels,
}: {
  products: Product[]
  locale: Locale
  currency: string
  labels: { from: string; stores: string; save: string }
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} locale={locale} currency={currency} labels={labels} />
      ))}
    </div>
  )
}
