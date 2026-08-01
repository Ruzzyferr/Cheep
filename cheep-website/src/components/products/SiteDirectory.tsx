import { SiteLink as Link } from '../ui/SiteLink'
import type { Category, City, Store } from '../../data/types'
import { categoryPath, cityPath, storePath } from '../../data/routes'
import { formatNumber } from '../../lib/format'
import type { Locale } from '../../i18n'

/**
 * Ürünler sayfasının altındaki dizin: kategori, market ve şehir sayfalarına
 * gerçek bağlantılar.
 *
 * NEDEN BURADA: bu iş eskiden ayrı bir `/fiyatlar` sayfasındaydı. O sayfa
 * menüden kaldırıldı ve tamamen silindi — ama görevi silinemezdi. Google
 * sayfaları sitemap'ten keşfeder, otoriteyi İÇ BAĞLANTILAR üzerinden dağıtır;
 * hiçbir sayfadan bağlantı almayan sayfa "öksüz" sayılır ve daha az değer
 * görür. 7.665 içerik sayfasının tek görünür girişi burasıydı.
 *
 * Sol sütundaki kategori listesiyle karıştırılmasın: ORASI filtre düğmesi
 * (aynı sayfada kalır), BURASI kategori SAYFASINA giden bağlantı (fiyat
 * geçmişi, market kırılımı, JSON-LD).
 */
export function SiteDirectory({
  categories,
  stores,
  cities,
  locale,
  labels,
}: {
  categories: Category[]
  stores: Store[]
  cities: City[]
  locale: Locale
  labels: { title: string; categories: string; stores: string; cities: string }
}) {
  if (categories.length === 0 && stores.length === 0 && cities.length === 0) return null
  const n = (v: number) => formatNumber(locale, v)

  return (
    <section className="mt-20 border-t border-line pt-12">
      <h2 className="text-xl font-bold text-ink">{labels.title}</h2>

      {categories.length > 0 && (
        <Block title={labels.categories}>
          {categories.map((cat) => (
            <Pill key={cat.slug} to={categoryPath(locale, cat.slug)}>
              {cat.name}
              <span className="tabular-nums text-ink-hint">{n(cat.productCount)}</span>
            </Pill>
          ))}
        </Block>
      )}

      {stores.length > 0 && (
        <Block title={labels.stores}>
          {stores.map((s) => (
            <Pill key={s.slug} to={storePath(locale, s.slug)}>
              {s.name}
            </Pill>
          ))}
        </Block>
      )}

      {cities.length > 0 && (
        <Block title={labels.cities}>
          {cities.map((c) => (
            <Pill key={c.slug} to={cityPath(locale, c.slug)}>
              {c.name}
            </Pill>
          ))}
        </Block>
      )}
    </section>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-hint">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Pill({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-paper px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-clementine hover:text-clementine-deep"
    >
      {children}
    </Link>
  )
}
