import { useContext } from 'react'
import { SiteLink as Link } from '../ui/SiteLink'
import { LocaleContext } from '../../i18n'
import { CONTENT } from '../../i18n/content'
import { PageDataContext } from '../../data/context'
import { summarize } from '../../data/types'
import { Reveal } from '../ui/Reveal'
import { formatMoney, formatPct } from '../../lib/money'
import { formatNumber } from '../../lib/format'
import { productPath, storePath, reportPath, comparePath, browsePath, productsPath, categoryPath } from '../../data/routes'

/**
 * Anasayfanın canlı vitrini: gerçek fiyat düşüşleri ve market sıralaması.
 *
 * Neden var: site bugüne kadar "fiyatları karşılaştırıyoruz" diye ANLATIYORDU
 * ama hiç GÖSTERMİYORDU. Giren kişi ilk ekranda gerçek ürün ve gerçek fark
 * görürse iddia kanıta dönüşüyor.
 *
 * İkinci faydası SEO: sitenin en yüksek otoriteli sayfasından içerik
 * sayfalarına doğrudan bağlantı veriyor, tarayıcı oraya buradan geçiyor.
 *
 * Veri yoksa (yerel geliştirme, API'siz build) bölüm hiç render edilmiyor —
 * boş bir vitrin göstermektense yokmuş gibi davranmak daha dürüst.
 */
export function LiveDrops() {
  const locale = useContext(LocaleContext)
  const data = useContext(PageDataContext)
  const c = CONTENT[locale]

  if (!data || data.payload.kind !== 'home') return null
  const { drops, stores, categories, totals } = data.payload
  if (drops.length === 0 && stores.length === 0) return null

  const currency = data.country.currency
  const n = (v: number) => formatNumber(locale, v)

  const title = locale === 'tr' ? 'Bugün ucuzlayanlar' : 'Dziś potaniały'
  const lead =
    locale === 'tr'
      ? `${n(totals.products)} üründe ${n(totals.stores)} marketin fiyatını izliyoruz. Son 28 günde en çok ucuzlayanlar:`
      : `Śledzimy ceny ${n(totals.stores)} sklepów dla ${n(totals.products)} produktów. Największe obniżki z 28 dni:`
  const rankTitle = locale === 'tr' ? 'Hangi market kaç üründe en ucuz?' : 'Który sklep najczęściej jest najtańszy?'
  const allLink = locale === 'tr' ? 'Tüm zam raporu' : 'Pełny raport cen'

  return (
    <section className="relative bg-cream-deep py-24 md:py-32">
      <div className="container-cheep">
        {/* Kart yoksa başlık da yok: "Bugün ucuzlayanlar" deyip altını boş
            bırakmak, bölümü hiç göstermemekten daha kötü. */}
        {drops.length > 0 && (
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow mb-4 text-clementine-deep">{c.report.title}</p>
            <h2 className="text-section text-ink">{title}</h2>
            <p className="mt-5 text-lg text-ink-soft">{lead}</p>
          </Reveal>
        )}

        {drops.length > 0 && (
          <Reveal stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {drops.map(({ product, changePct }) => {
              const s = summarize(product.offers)
              if (!s) return null
              return (
                <Link
                  key={product.slug}
                  to={productPath(locale, product.slug)}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 transition-all hover:-translate-y-0.5 hover:border-clementine/40 hover:shadow-lg"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream-deep">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt=""
                        loading="lazy"
                        width={64}
                        height={64}
                        className="h-16 w-auto max-w-full object-contain"
                      />
                    ) : (
                      <span aria-hidden="true" className="font-display text-xl text-ink-hint">
                        {(product.brand || product.name).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{product.name}</p>
                    <p className="mt-1 text-sm tabular-nums text-ink-soft">
                      {formatMoney(locale, currency, s.min)}{' '}
                      <span className="text-ink-hint">· {s.cheapest.storeName}</span>
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-mint-soft px-3 py-1 text-sm font-bold tabular-nums text-mint-deep">
                    −{formatPct(locale, Math.abs(changePct))}
                  </span>
                </Link>
              )
            })}
          </Reveal>
        )}

        {drops.length > 0 && (
        <div className="mt-8 text-center">
          <Link
            to={reportPath(locale)}
            className="inline-flex min-h-11 items-center rounded-full border border-ink/15 px-6 py-3 font-semibold text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
          >
            {allLink} →
          </Link>
        </div>
        )}

        {stores.length > 0 && (
          <div className="mt-20">
            <Reveal className="mx-auto mb-8 max-w-2xl text-center">
              <h3 className="text-2xl font-bold text-ink md:text-3xl">{rankTitle}</h3>
            </Reveal>

            <Reveal stagger className="mx-auto flex max-w-4xl flex-wrap justify-center gap-3">
              {stores.map(({ store, cheapestCount }, i) => (
                <Link
                  key={store.slug}
                  to={storePath(locale, store.slug)}
                  className={`inline-flex min-h-11 items-center gap-3 rounded-full border px-5 py-3 transition-colors ${
                    i === 0
                      ? 'border-mint-deep bg-mint-soft text-mint-deep'
                      : 'border-line bg-paper text-ink hover:border-clementine hover:text-clementine-deep'
                  }`}
                >
                  <span className="font-semibold">{store.name}</span>
                  <span className="tabular-nums text-sm opacity-70">{n(cheapestCount)}</span>
                </Link>
              ))}
            </Reveal>

            <div className="mt-8 text-center">
              <Link
                to={comparePath(locale)}
                className="inline-flex min-h-11 items-center font-semibold text-clementine-deep hover:underline"
              >
                {c.compare.title} →
              </Link>
            </div>
          </div>
        )}

        {/* Kategoriler — sitedeki 7.600 sayfaya görünür giriş.
            Bu blok eklenene kadar anasayfadan içeriğe giden hiçbir yol yoktu:
            kullanıcı ancak yukarıdaki 6 ürün kartının kategorisine tıklayarak
            dolambaçlı şekilde ulaşabiliyordu. */}
        {categories.length > 0 && (
          <div className="mt-20">
            <Reveal className="mx-auto mb-8 max-w-2xl text-center">
              <h3 className="text-2xl font-bold text-ink md:text-3xl">{c.browse.categories}</h3>
            </Reveal>

            <Reveal stagger className="mx-auto flex max-w-4xl flex-wrap justify-center gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  to={categoryPath(locale, cat.slug)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-line bg-paper px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
                >
                  {cat.name}
                  <span className="tabular-nums text-ink-hint">{n(cat.productCount)}</span>
                </Link>
              ))}
            </Reveal>

            {/*
              Birincil aksiyon ÜRÜNLER sayfası: kullanıcı buraya ürün aramaya
              geliyor, kategori/market/şehir dizinine değil. Dizin (`/fiyatlar`)
              footer'dan erişilebilir kalıyor — 7.665 SEO sayfasına iç bağlantıyı
              o dağıtıyor, öksüz bırakılamaz.
            */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={productsPath(locale)}
                className="inline-flex min-h-11 items-center rounded-full bg-clementine-deep px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-clementine-dark"
              >
                {c.products.title} →
              </Link>
              <Link
                to={browsePath(locale)}
                className="inline-flex min-h-11 items-center rounded-full border border-ink/15 px-6 py-4 font-semibold text-ink transition-colors hover:border-clementine hover:text-clementine-deep"
              >
                {c.browse.title} →
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
