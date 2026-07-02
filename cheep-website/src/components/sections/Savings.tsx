import { Reveal } from '../ui/Reveal'
import { CountUp } from '../ui/CountUp'

const STATS: { value: number; suffix?: string; prefix?: string; label: string; decimals?: number }[] = [
  { value: 18000, suffix: '+', label: 'eşleştirilmiş ürün' },
  { value: 16500, suffix: '+', label: 'market şubesi' },
  { value: 5, label: 'ülke, tek uygulama' },
  { value: 7, label: 'günde bir güncelleme' },
]

export function Savings() {
  return (
    <section id="savings" className="relative overflow-hidden bg-mint-soft py-28 md:py-36">
      <div className="container-cheep text-center">
        <Reveal>
          <p className="eyebrow mb-4 text-forest">Ne kadar ediyor?</p>
          <h2 className="mx-auto max-w-3xl text-section text-ink">
            Ortalama bir sepette
            <span className="block text-gradient-forest">
              <CountUp to={23} suffix="%" /> daha az öde
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
            Kullanıcıların listelerini en uygun markete taşıdığında bıraktığı ortalama fark.
            Küçük gibi görünür; ayda, yılda toplamı büyür.
          </p>
        </Reveal>

        <Reveal stagger className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-3xl border border-mint/30 bg-paper/70 p-7 backdrop-blur transition-transform duration-500 hover:-translate-y-1"
            >
              <div className="font-display text-4xl font-bold text-forest md:text-5xl">
                <CountUp to={s.value} suffix={s.suffix} prefix={s.prefix} decimals={s.decimals} />
              </div>
              <p className="mt-2 text-sm text-ink-soft">{s.label}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
