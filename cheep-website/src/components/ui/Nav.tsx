import { useEffect, useState } from 'react'
import { CheepBird } from '../brand/CheepBird'
import { cn } from '../../lib/utils'

const LINKS = [
  { label: 'Nasıl çalışır', href: '#how' },
  { label: 'Tasarruf', href: '#savings' },
  { label: 'Ülkeler', href: '#coverage' },
  { label: 'Özellikler', href: '#features' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          'flex w-full max-w-[1240px] items-center justify-between rounded-full px-3 py-2.5 transition-all duration-500',
          scrolled ? 'glass shadow-soft' : 'bg-transparent',
        )}
      >
        <a href="#top" className="flex items-center gap-2 pl-1.5" aria-label="Cheep ana sayfa">
          <CheepBird size={38} shadow={false} />
          <span className="font-display text-2xl font-bold tracking-tight text-forest-deep">
            Cheep
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-[0.95rem] font-medium text-ink-soft transition-colors hover:bg-mint-soft hover:text-forest-deep"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="#download"
          className="rounded-full bg-forest px-5 py-2.5 text-[0.95rem] font-semibold text-cream shadow-soft transition-all duration-300 hover:bg-forest-deep hover:shadow-lift"
        >
          İndir
        </a>
      </nav>
    </header>
  )
}
