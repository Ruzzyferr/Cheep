import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SiteLink as Link } from './SiteLink'
import { cn } from '../../lib/utils'
import {
  LOCALES,
  LOCALE_NATIVE_NAMES,
  localeHref,
  stripLocale,
  useLocale,
  useT,
  type Locale,
} from '../../i18n'
import { isContentPath } from '../../data/routes'

/**
 * Dil seçici.
 *
 * NEDEN BİR MENÜ, TEK BİR BAĞLANTI DEĞİL: burada eskiden tek bir bağlantı
 * vardı ve hedefi `LOCALES.find((l) => l !== locale)` ile seçiliyordu — yani
 * "geçerli olmayan İLK dil". Site iki dilliyken (tr/pl) bu doğru çalışıyordu:
 * "diğer dil" tek ve belirliydi. Beş dille aynı ifade ARTIK YANLIŞ — listedeki
 * ilk yabancı dile götürür ve kullanıcının geri kalan üç dile ULAŞMASININ
 * HİÇBİR YOLU KALMAZ. Hırvatça sayfadaki kullanıcı yalnızca Türkçe'ye
 * geçebilir, Macarca ya da Romence'ye asla.
 *
 * Diller daima KENDİ adlarıyla listelenir ("Magyar", "Hrvatski") — arayüzü
 * anlamayan kullanıcı kendi dilini ancak böyle bulabilir, ki seçicinin varlık
 * sebebi tam olarak o durumdur.
 */
function targetHref(locale: Locale, pathname: string): string {
  // İÇERİK sayfalarının dil karşılığı YOKTUR (ülke katalogları farklı ürünler
  // içeriyor — bkz. data/routes.ts). Yalnızca önek takmak ölü bir adres
  // üretirdi; oradan o dilin ANASAYFASINA gönderiyoruz.
  const rest = stripLocale(pathname)
  return localeHref(locale, isContentPath(rest) ? '/' : rest)
}

export function LanguageMenu({ className, onNavigate }: {
  className?: string
  onNavigate?: () => void
}) {
  const t = useT()
  const active = useLocale()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Dışarı tıklama ve Escape ile kapanma: açık kalan bir menü mobilde
  // sayfanın üstünü kapatıyor ve kullanıcı kapatmanın yolunu bulamıyor.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.nav.langMenuLabel}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-forest/20 px-3.5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-forest-deep transition-colors hover:bg-mint-soft"
      >
        {/* Bayrak KULLANILMIYOR: bayrak ülkeyi anlatır, dili değil (Romence
            Moldova'da da konuşulur; Almanca üç ülkede resmîdir) ve yanlış
            eşleştirme siyasi rahatsızlık yaratabiliyor. Dil kodu nötr. */}
        <span aria-hidden>{active.toUpperCase()}</span>
        <svg
          aria-hidden
          viewBox="0 0 12 8"
          className={cn('h-2 w-3 transition-transform duration-200', open && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 1.5 6 6.5 11 1.5" />
        </svg>
      </button>

      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-40 overflow-hidden rounded-2xl border border-forest/15 bg-cream shadow-lift"
        >
          {LOCALES.map((locale) => {
            const current = locale === active
            return (
              <li key={locale} role="none">
                <Link
                  role="menuitem"
                  to={targetHref(locale, pathname)}
                  hrefLang={locale}
                  lang={locale}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false)
                    onNavigate?.()
                  }}
                  className={cn(
                    'flex min-h-11 items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors',
                    current
                      ? 'bg-mint-soft text-forest-deep'
                      : 'text-forest-deep hover:bg-mint-soft/60',
                  )}
                >
                  <span className="font-mono text-[0.7rem] uppercase tracking-wider opacity-60">
                    {locale}
                  </span>
                  {LOCALE_NATIVE_NAMES[locale]}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
