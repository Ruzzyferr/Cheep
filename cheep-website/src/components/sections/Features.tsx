import type { ReactNode } from 'react'
import { Reveal } from '../ui/Reveal'
import { cn } from '../../lib/utils'
import { useT } from '../../i18n'

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
        'spotlight-card group rounded-[28px] border border-mint/15 bg-forest-dark/60 p-7 transition-all duration-500 hover:-translate-y-1 hover:border-mint/40 md:p-8',
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  )
}

/** Bento düzeni: ilk kart geniş, kalan dördü ikişer sütun. Sıraya bağlı, dile değil. */
const SPANS = ['md:col-span-4', 'md:col-span-2', 'md:col-span-2', 'md:col-span-2', 'md:col-span-2']
const TINTS = ['bg-mint/15', 'bg-clementine/20', 'bg-lilac/25', 'bg-mint/15', 'bg-clementine/20']

export function Features() {
  const t = useT()

  return (
    <section id="features" className="relative overflow-hidden bg-forest-deep py-24 text-cream md:py-36">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-mint/10 blur-[130px]" />
      <div className="container-cheep relative">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="eyebrow mb-4 text-mint">{t.features.eyebrow}</p>
          <h2 className="text-section text-cream">{t.features.title}</h2>
          <p className="mt-5 text-lg text-cream/70">{t.features.sub}</p>
        </Reveal>

        <Reveal stagger className="grid grid-cols-1 gap-5 md:grid-cols-6">
          {t.features.items.map((item, i) => (
            <Spot key={item.title} className={SPANS[i]}>
              <span
                aria-hidden
                className={cn(
                  'mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl text-2xl',
                  TINTS[i],
                )}
              >
                {item.emoji}
              </span>
              <h3 className="mb-2 text-2xl text-cream">{item.title}</h3>
              <p className={cn('text-cream/70', i === 0 && 'max-w-lg')}>{item.body}</p>
            </Spot>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
