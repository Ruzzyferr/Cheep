import { Reveal } from '../ui/Reveal'

// 2-letter codes render deterministically on every OS (flag emoji don't on Windows)
const COUNTRIES = [
  { code: 'TR', tint: '#E30A17', name: 'Türkiye', stores: '7.272 şube', live: true },
  { code: 'DE', tint: '#111111', name: 'Almanya', stores: '4.925 şube', live: false },
  { code: 'CH', tint: '#D52B1E', name: 'İsviçre', stores: '2.008 şube', live: false },
  { code: 'SE', tint: '#006AA7', name: 'İsveç', stores: '1.554 şube', live: false },
  { code: 'PL', tint: '#DC143C', name: 'Polonya', stores: '730 şube', live: false },
]

const BRANDS = [
  'Migros', 'A101', 'BİM', 'ŞOK', 'CarrefourSA',
  'Lidl', 'Biedronka', 'Żabka', 'ICA', 'REWE', 'Kaufland', 'Coop', 'Auchan',
]

export function Coverage() {
  return (
    <section id="coverage" className="relative overflow-hidden bg-cream py-28 md:py-36">
      <div className="container-cheep">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="eyebrow mb-4 text-clementine">Kapsam</p>
          <h2 className="text-section text-ink">
            Türkiye’de canlı, <span className="text-gradient-forest">Avrupa yolda</span>
          </h2>
          <p className="mt-5 text-lg text-ink-soft">
            Aynı motor beş ülkede çalışıyor. Fiyatlar barkod bazında eşleşiyor, her hafta
            gerçek mağaza verisiyle güncelleniyor.
          </p>
        </Reveal>

        <Reveal stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {COUNTRIES.map((c) => (
            <div
              key={c.name}
              className="relative overflow-hidden rounded-3xl border border-line bg-paper p-6 text-center shadow-soft transition-all duration-500 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
                style={{ backgroundColor: c.tint }}
                aria-hidden
              />
              <div
                className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl font-display text-xl font-bold text-white"
                style={{ backgroundColor: c.tint }}
              >
                {c.code}
              </div>
              <p className="font-display text-lg font-bold text-ink">{c.name}</p>
              <p className="mt-1 font-mono text-xs text-ink-soft">{c.stores}</p>
              <span
                className={
                  'mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wider ' +
                  (c.live ? 'bg-mint-soft text-forest' : 'bg-cream-deep text-ink-soft')
                }
              >
                <span className={'h-1.5 w-1.5 rounded-full ' + (c.live ? 'animate-pulse bg-mint-500' : 'bg-ink-hint')} />
                {c.live ? 'Canlı' : 'Yakında'}
              </span>
            </div>
          ))}
        </Reveal>
      </div>

      {/* brand marquee */}
      <div className="relative mt-20 flex flex-col gap-3 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-cream to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-cream to-transparent" />
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
