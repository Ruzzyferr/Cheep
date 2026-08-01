import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SiteLink as Link } from './SiteLink'
import { CheepBird } from '../brand/CheepBird'
import { cn } from '../../lib/utils'
import { useT, useLocale, useHref, localeHref, stripLocale, LOCALES } from '../../i18n'

/** Aktif sayfanın diğer dildeki karşılığı. */
function useOtherLocale(): { locale: string; href: string } {
  const locale = useLocale()
  const { pathname } = useLocation()
  const other = LOCALES.find((l) => l !== locale) ?? locale
  return { locale: other, href: localeHref(other, stripLocale(pathname)) }
}

export function Nav() {
  const t = useT()
  const href = useHref()
  const other = useOtherLocale()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 40)
      // Mobilde pill neredeyse tam genişlikte; sabit dururken altındaki başlık
      // satırını kapatıyordu. Aşağı kaydırırken gizle, yukarı kaydırınca geri getir.
      if (!open) setHidden(y > 220 && y > lastY.current)
      lastY.current = y
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [open])

  // Menü açıkken arka planın kaymasını engelle + Esc ile kapat.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] transition-transform duration-300',
        // Gizleme yalnızca mobilde; masaüstünde pill her zaman görünür kalır.
        hidden ? '-translate-y-[140%] md:translate-y-0' : 'translate-y-0',
      )}
    >
      <nav
        className={cn(
          // relative z-50: mobil menü (z-40) header'ın içinde, pill onun üstünde kalmalı
          'relative z-50 flex w-full max-w-[1240px] items-center justify-between rounded-full px-3 py-2 transition-all duration-500',
          scrolled || open ? 'glass shadow-soft' : 'bg-transparent',
        )}
      >
        <Link to={href('/')} className="flex items-center gap-2 py-1 pl-1.5" aria-label={t.nav.home}>
          <CheepBird size={38} shadow={false} />
          <span className="font-display text-2xl font-bold tracking-tight text-forest-deep">
            Cheep
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {t.nav.links.map((l) => (
            <a
              key={l.href}
              href={href(l.href)}
              className="rounded-full px-4 py-2.5 text-[0.95rem] font-medium text-ink-soft transition-colors hover:bg-mint-soft hover:text-forest-deep"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={other.href}
            hrefLang={other.locale}
            className="hidden rounded-full border border-forest/20 px-3.5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-forest-deep transition-colors hover:bg-mint-soft sm:inline-flex"
          >
            {t.nav.langSwitchTo}
          </Link>

          <a
            href={href('#download')}
            className="rounded-full bg-forest px-5 py-3 text-[0.95rem] font-semibold text-cream shadow-soft transition-all duration-300 hover:bg-forest-deep hover:shadow-lift"
          >
            {t.nav.download}
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="grid h-11 w-11 place-items-center rounded-full border border-forest/20 text-forest-deep transition-colors hover:bg-mint-soft md:hidden"
          >
            <span aria-hidden className="relative block h-4 w-5">
              <span
                className={cn(
                  'absolute inset-x-0 top-0 h-0.5 rounded bg-current transition-transform duration-300',
                  open && 'top-1/2 rotate-45',
                )}
              />
              <span
                className={cn(
                  'absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-current transition-opacity duration-200',
                  open && 'opacity-0',
                )}
              />
              <span
                className={cn(
                  'absolute inset-x-0 bottom-0 h-0.5 rounded bg-current transition-transform duration-300',
                  open && 'bottom-auto top-1/2 -rotate-45',
                )}
              />
            </span>
          </button>
        </div>
      </nav>

      {/* Mobil menü */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-0 top-0 z-40 flex flex-col bg-cream/97 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-28 backdrop-blur-xl md:hidden"
      >
        <nav className="flex flex-col gap-1">
          {t.nav.links.map((l) => (
            <a
              key={l.href}
              href={href(l.href)}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-4 font-display text-2xl font-bold text-ink transition-colors hover:bg-mint-soft"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-8">
          <a
            href={href('#download')}
            onClick={() => setOpen(false)}
            className="rounded-full bg-clementine-deep px-6 py-4 text-center text-base font-semibold text-white shadow-clementine"
          >
            {t.nav.download}
          </a>
          <Link
            to={other.href}
            hrefLang={other.locale}
            onClick={() => setOpen(false)}
            className="rounded-full border border-forest/25 px-6 py-4 text-center text-base font-semibold text-forest-deep"
          >
            {t.nav.langSwitchTo}
          </Link>
        </div>
      </div>
    </header>
  )
}
