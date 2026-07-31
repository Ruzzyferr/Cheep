import { Reveal } from '../ui/Reveal'
import { cn } from '../../lib/utils'
import { useT } from '../../i18n'

export function Compare() {
  const t = useT()
  const c = t.compare.card

  return (
    <section id="compare" className="relative overflow-hidden bg-forest-deep py-24 text-cream md:py-36">
      {/* soft glows */}
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-mint/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-clementine/20 blur-[120px]" />

      <div className="container-cheep relative grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <Reveal className="max-w-xl">
          <p className="eyebrow mb-5 text-mint">{t.compare.eyebrow}</p>
          <h2 className="text-section text-cream">
            {t.compare.titleLead}{' '}
            <span className="text-gradient-clementine">{t.compare.titleAccent}</span>
          </h2>
          <p className="mt-6 text-lg text-cream/70">{t.compare.body}</p>
          <div className="mt-8 flex items-start gap-3 font-mono text-sm text-mint">
            <span className="mt-2 inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-mint" />
            {t.compare.sourceNote}
          </div>
        </Reveal>

        {/* comparison card */}
        <Reveal y={60} className="justify-self-center">
          <div className="w-[min(92vw,440px)] rounded-[28px] bg-paper p-6 text-ink shadow-lift">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-xl font-bold">{c.name}</p>
                <p className="font-mono text-xs text-ink-soft">{c.unit}</p>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint-soft text-2xl">
                {c.emoji}
              </div>
            </div>

            <div className="space-y-2.5">
              {c.rows.map((r) => (
                <div
                  key={r.store}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-2xl border px-4 py-3.5 transition-transform',
                    r.cheapest
                      ? 'scale-[1.03] border-mint bg-mint-soft shadow-soft'
                      : 'border-line bg-cream/60',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-8 w-8 shrink-0 rounded-lg"
                      style={{ backgroundColor: r.color }}
                      aria-hidden
                    />
                    <span className="font-semibold">{r.store}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.cheapest && (
                      // Dar ekranda rozet yalnızca ✓; etiket ("Najtaniej" uzun)
                      // ekran okuyucuya sr-only olarak kalır, sm'den itibaren görünür.
                      <span className="rounded-full bg-forest px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-white sm:px-2.5 sm:text-[0.65rem]">
                        <span aria-hidden className="sm:hidden">
                          ✓
                        </span>
                        <span className="max-sm:sr-only">{c.cheapestBadge}</span>
                      </span>
                    )}
                    <span
                      className={cn(
                        'font-mono text-lg font-bold',
                        r.cheapest ? 'text-mint-deep' : 'text-ink',
                      )}
                    >
                      {r.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-forest px-4 py-3 text-cream">
              <span className="text-sm">{c.savingLabel}</span>
              <span className="font-mono text-lg font-bold text-mint">{c.savingValue}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
