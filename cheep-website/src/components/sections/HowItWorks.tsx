import { Reveal } from '../ui/Reveal'
import { CheepBird, type BirdExpression } from '../brand/CheepBird'

const STEPS: { n: string; title: string; body: string; expr: BirdExpression }[] = [
  {
    n: '01',
    title: 'Listeni oluştur',
    body: 'Alacaklarını yaz ya da ürünleri ara. Süt, yumurta, deterjan… ne varsa listene ekle.',
    expr: 'search',
  },
  {
    n: '02',
    title: 'Cheep karşılaştırır',
    body: 'Her ürünü barkodundan eşleştirip tüm marketlerin güncel fiyatlarını tarar. Saniyeler içinde.',
    expr: 'happy',
  },
  {
    n: '03',
    title: 'En ucuza git',
    body: 'Sepetini en uygun markete taşı, en yakın şubeyi gör. Ne kadar kazandığını anında öğren.',
    expr: 'celebrate',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="relative bg-cream py-28 md:py-36">
      <div className="container-cheep">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <p className="eyebrow mb-4 text-clementine">Nasıl çalışır</p>
          <h2 className="text-section text-ink">Üç adımda tasarruf</h2>
          <p className="mt-5 text-lg text-ink-soft">
            Karmaşık değil. Listeni ver, gerisini Cheep halletsin.
          </p>
        </Reveal>

        <Reveal stagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group relative overflow-hidden rounded-[28px] border border-line bg-paper p-8 shadow-soft transition-all duration-500 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <span className="pointer-events-none absolute -right-4 -top-6 font-display text-[7rem] font-bold leading-none text-mint-soft transition-colors duration-500 group-hover:text-mint/30">
                {s.n}
              </span>
              <div className="relative">
                <div className="mb-6 inline-grid place-items-center rounded-3xl bg-mint-soft p-3 transition-transform duration-500 group-hover:scale-110">
                  <CheepBird size={68} expression={s.expr} shadow={false} blink={false} />
                </div>
                <h3 className="mb-3 text-2xl text-ink">{s.title}</h3>
                <p className="text-ink-soft">{s.body}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
