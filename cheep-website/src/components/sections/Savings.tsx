import { Reveal } from '../ui/Reveal'
import { CountUp } from '../ui/CountUp'
import { useT } from '../../i18n'
import { HEADLINE_STATS } from '../../config'

/** Sayısal değerler config'ten; `updates` sayı değil, dile bağlı bir metin. */
const NUMERIC: Record<string, { value: number; suffix?: string }> = {
  products: { value: HEADLINE_STATS.products, suffix: '+' },
  branches: { value: HEADLINE_STATS.branches, suffix: '+' },
  countries: { value: HEADLINE_STATS.countries },
}

export function Savings() {
  const t = useT()

  return (
    <section id="savings" className="relative overflow-hidden bg-mint-soft py-24 md:py-36">
      <div className="container-cheep text-center">
        <Reveal>
          <p className="eyebrow mb-4 text-forest">{t.savings.eyebrow}</p>
          <h2 className="mx-auto max-w-3xl text-section text-ink">
            {t.savings.titleLead}
            <span className="block text-gradient-forest">
              <CountUp to={HEADLINE_STATS.avgSavingPct} suffix="%" />
              {t.savings.titleAccentSuffix}
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">{t.savings.sub}</p>
        </Reveal>

        <Reveal stagger className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {t.savings.stats.map((s) => {
            const numeric = NUMERIC[s.key]
            return (
              <div
                key={s.key}
                className="rounded-3xl border border-mint/30 bg-paper/70 p-6 backdrop-blur transition-transform duration-500 hover:-translate-y-1 md:p-7"
              >
                <div className="font-display text-3xl font-bold text-forest sm:text-4xl md:text-5xl">
                  {numeric ? (
                    <CountUp to={numeric.value} suffix={numeric.suffix} />
                  ) : (
                    t.savings.updatesValue
                  )}
                </div>
                <p className="mt-2 text-sm text-ink-soft">{s.label}</p>
              </div>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}
