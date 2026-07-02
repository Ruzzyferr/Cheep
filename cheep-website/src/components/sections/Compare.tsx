import { Reveal } from '../ui/Reveal'
import { cn } from '../../lib/utils'

type Row = { store: string; price: string; cheapest?: boolean; color: string }

const PRODUCTS: { name: string; unit: string; rows: Row[] }[] = [
  {
    name: 'Tam Yağlı Süt',
    unit: '1 L · aynı marka, aynı ürün',
    rows: [
      { store: 'Migros', price: '₺31,00', color: '#FF7A00' },
      { store: 'A101', price: '₺28,50', color: '#00507D' },
      { store: 'BİM', price: '₺29,40', color: '#6B8E7F' },
      { store: 'ŞOK', price: '₺27,90', cheapest: true, color: '#E31E24' },
    ],
  },
]

export function Compare() {
  const p = PRODUCTS[0]
  return (
    <section id="compare" className="relative overflow-hidden bg-forest-deep py-28 text-cream md:py-36">
      {/* soft glows */}
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-mint/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-clementine/20 blur-[120px]" />

      <div className="container-cheep relative grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <Reveal className="max-w-xl">
          <p className="eyebrow mb-5 text-mint">Resmi veri · her hafta güncel</p>
          <h2 className="text-section text-cream">
            Aynı ürün, <span className="text-gradient-clementine">her markette farklı fiyat.</span>
          </h2>
          <p className="mt-6 text-lg text-cream/70">
            Bir kutu süt için marketten markete %10–15 fark ödeyebilirsin. Cheep, aynı ürünün
            zincirlerdeki fiyatını yan yana koyar ve en ucuzunu saniyede önüne getirir —
            tahmin yok, gezmek yok.
          </p>
          <div className="mt-8 flex items-center gap-3 font-mono text-sm text-mint">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-mint" />
            Türkiye’de T.C. Ticaret Bakanlığı resmi verisi · her hafta güncel
          </div>
        </Reveal>

        {/* comparison card */}
        <Reveal y={60} className="justify-self-center">
          <div className="w-[min(92vw,440px)] rounded-[28px] bg-paper p-6 text-ink shadow-lift">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-display text-xl font-bold">{p.name}</p>
                <p className="font-mono text-xs text-ink-soft">{p.unit}</p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mint-soft text-2xl">🥛</div>
            </div>

            <div className="space-y-2.5">
              {p.rows.map((r) => (
                <div
                  key={r.store}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-transform',
                    r.cheapest
                      ? 'scale-[1.03] border-mint bg-mint-soft shadow-soft'
                      : 'border-line bg-cream/60',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-8 rounded-lg"
                      style={{ backgroundColor: r.color }}
                      aria-hidden
                    />
                    <span className="font-semibold">{r.store}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.cheapest && (
                      <span className="rounded-full bg-mint-500 px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-white">
                        En ucuz
                      </span>
                    )}
                    <span
                      className={cn(
                        'font-mono text-lg font-bold',
                        r.cheapest ? 'text-mint-500' : 'text-ink',
                      )}
                    >
                      {r.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-forest px-4 py-3 text-cream">
              <span className="text-sm">Bu üründe tasarrufun</span>
              <span className="font-mono text-lg font-bold text-mint">₺3,10 · %10</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
