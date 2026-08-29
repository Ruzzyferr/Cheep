import { Reveal } from '../ui/Reveal'
import { useT, useLocale } from '../../i18n'
import { formatNumber } from '../../lib/format'
import { COVERAGE } from '../../config'

/**
 * Bayrak emojileri Windows'ta render edilmiyor; ülkeyi iki harfli kodla ve
 * bayrak renklerinden oluşan bir şeritle gösteriyoruz. `badge` rozetin dolgusu,
 * `flag` üstteki ince şerit (Polonya beyaz/kırmızı, Almanya siyah/kırmızı/altın).
 */
const FLAGS: Record<string, { badge: string; flag: string }> = {
  TR: { badge: '#E30A17', flag: '#E30A17' },
  PL: { badge: '#DC143C', flag: 'linear-gradient(to bottom, #FFFFFF 50%, #DC143C 50%)' },
  DE: { badge: '#111111', flag: 'linear-gradient(to bottom, #000 33.3%, #DD0000 33.3% 66.6%, #FFCE00 66.6%)' },
  CH: { badge: '#D52B1E', flag: '#D52B1E' },
  SE: { badge: '#006AA7', flag: 'linear-gradient(to bottom, #006AA7 38%, #FECC00 38% 62%, #006AA7 62%)' },
  HR: { badge: '#171796', flag: 'linear-gradient(to bottom, #FF0000 33.3%, #FFFFFF 33.3% 66.6%, #171796 66.6%)' },
  HU: { badge: '#477050', flag: 'linear-gradient(to bottom, #CE2939 33.3%, #FFFFFF 33.3% 66.6%, #477050 66.6%)' },
  RO: { badge: '#002B7F', flag: 'linear-gradient(to right, #002B7F 33.3%, #FCD116 33.3% 66.6%, #CE1126 66.6%)' },
}

/**
 * Şeritte dönen market adları. YALNIZCA verisi gerçekten akan zincirler —
 * burada bir marka göstermek "bu marketin fiyatları var" iddiasıdır.
 * HR/HU/RO zincirleri (Konzum, Plodine, Tesco, Mega Image…) ülkeler canlıya
 * alındığında eklenecek.
 */
const BRANDS = [
  'Migros', 'A101', 'BİM', 'ŞOK', 'CarrefourSA', 'Tarım Kredi',
  'Biedronka', 'Lidl', 'Żabka', 'Auchan', 'Carrefour',
]

export function Coverage() {
  const t = useT()
  const locale = useLocale()

  return (
    <section id="coverage" className="relative overflow-hidden bg-cream py-24 md:py-36">
      <div className="container-cheep">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="eyebrow mb-4 text-clementine-deep">{t.coverage.eyebrow}</p>
          <h2 className="text-section text-ink">
            {t.coverage.titleLead}{' '}
            <span className="text-gradient-forest">{t.coverage.titleAccent}</span>
          </h2>
          <p className="mt-5 text-lg text-ink-soft">{t.coverage.sub}</p>
        </Reveal>

        <Reveal stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {t.coverage.countries.map((c) => {
            const data = COVERAGE[c.code]
            const flag = FLAGS[c.code]
            return (
              <div
                key={c.code}
                className="relative overflow-hidden rounded-3xl border border-line bg-paper p-6 text-center shadow-soft transition-all duration-500 hover:-translate-y-1.5 hover:shadow-lift"
              >
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
                  style={{ background: flag.flag }}
                  aria-hidden
                />
                <div
                  className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl font-display text-xl font-bold text-white"
                  style={{ backgroundColor: flag.badge }}
                  aria-hidden
                >
                  {c.code}
                </div>
                <p className="font-display text-lg font-bold text-ink">{c.name}</p>
                <p className="mt-1 font-mono text-xs text-ink-soft">
                  {formatNumber(locale, data.branches)} {t.coverage.branchesUnit}
                </p>
                <span
                  className={
                    'mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wider ' +
                    (data.live ? 'bg-mint-soft text-forest' : 'bg-cream-deep text-ink-soft')
                  }
                >
                  <span
                    className={
                      'h-1.5 w-1.5 rounded-full ' +
                      (data.live ? 'animate-pulse bg-mint-500' : 'bg-ink-hint')
                    }
                  />
                  {data.live ? t.coverage.live : t.coverage.soon}
                </span>
              </div>
            )
          })}
        </Reveal>
      </div>

      {/* brand marquee */}
      <div className="relative mt-20 flex flex-col gap-3 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-cream to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-cream to-transparent sm:w-32" />
        <div className="flex w-max animate-marquee gap-4">
          {[...BRANDS, ...BRANDS].map((b, i) => (
            <span
              key={i}
              className="whitespace-nowrap rounded-2xl border border-line bg-paper px-6 py-3 font-display text-lg font-semibold text-ink-soft"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
