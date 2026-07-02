import type { ReactNode } from 'react'
import { Reveal } from '../ui/Reveal'
import { cn } from '../../lib/utils'

function Spot({ children, className }: { children: ReactNode; className?: string }) {
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <div
      onMouseMove={onMove}
      className={cn(
        'spotlight-card group rounded-[28px] border border-mint/15 bg-forest-dark/60 p-8 transition-all duration-500 hover:-translate-y-1 hover:border-mint/40',
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export function Features() {
  return (
    <section id="features" className="relative overflow-hidden bg-forest-deep py-28 text-cream md:py-36">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-mint/10 blur-[130px]" />
      <div className="container-cheep relative">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="eyebrow mb-4 text-mint">Özellikler</p>
          <h2 className="text-section text-cream">Sadece fiyat değil, akıl</h2>
          <p className="mt-5 text-lg text-cream/70">
            Cheep’i gerçekten kullanışlı yapan detaylar.
          </p>
        </Reveal>

        <Reveal stagger className="grid grid-cols-1 gap-5 md:grid-cols-6">
          <Spot className="md:col-span-4">
            <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl bg-mint/15 text-2xl">🔖</span>
            <h3 className="mb-2 text-2xl text-cream">Barkod eşleştirmeli fiyat</h3>
            <p className="max-w-lg text-cream/70">
              “Süt” değil, <em>o</em> süt. Ürünleri EAN barkodundan eşleştiririz; farklı
              marketlerdeki tam aynı ürünü birebir karşılaştırırsın. Yanıltıcı eşleşme yok.
            </p>
          </Spot>

          <Spot className="md:col-span-2">
            <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl bg-clementine/20 text-2xl">📍</span>
            <h3 className="mb-2 text-2xl text-cream">En yakın şube</h3>
            <p className="text-cream/70">Konumundan gerçek mesafeyle en yakın ve en ucuz şubeyi gösterir.</p>
          </Spot>

          <Spot className="md:col-span-2">
            <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl bg-lilac/25 text-2xl">🤖</span>
            <h3 className="mb-2 text-2xl text-cream">Cheep Asistan</h3>
            <p className="text-cream/70">“Bu hafta kahvaltılık en ucuz nerede?” diye sor, yapay zekâ listeni kursun.</p>
          </Spot>

          <Spot className="md:col-span-2">
            <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl bg-mint/15 text-2xl">📈</span>
            <h3 className="mb-2 text-2xl text-cream">Fiyat geçmişi</h3>
            <p className="text-cream/70">Bir ürün gerçekten ucuzladı mı? Geçmiş fiyatı gör, indirime kanma.</p>
          </Spot>

          <Spot className="md:col-span-2">
            <span className="mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl bg-clementine/20 text-2xl">🧺</span>
            <h3 className="mb-2 text-2xl text-cream">Akıllı listeler</h3>
            <p className="text-cream/70">Sepetini oluştur; hangi markette toplam ne kadar tutuyor, tek bakışta gör.</p>
          </Spot>
        </Reveal>
      </div>
    </section>
  )
}
