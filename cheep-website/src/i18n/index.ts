import { createContext, useContext } from 'react'
import type { Dict } from './types'
import { tr } from './tr'
import { pl } from './pl'

export type Locale = 'tr' | 'pl'

export const LOCALES: Locale[] = ['tr', 'pl']
export const DEFAULT_LOCALE: Locale = 'tr'

export const DICTS: Record<Locale, Dict> = { tr, pl }

/**
 * Bir dile ait yol öneki. Varsayılan dil köke oturur (`/`), diğerleri
 * kendi klasörüne (`/pl`). SEO tarafında canonical ve hreflang bu düzeni izler.
 */
export function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`
}

/**
 * Sözlükteki dilden bağımsız yolları (`/privacy`) aktif dile göre çözer.
 * Bağlantı (`#how`), `mailto:` ve mutlak URL'lere dokunmaz.
 */
export function localeHref(locale: Locale, href: string): string {
  if (!href.startsWith('/')) return href
  const prefix = localePrefix(locale)
  return `${prefix}${href === '/' ? '' : href}` || '/'
}

/** URL yolundan dili okur. `/pl`, `/pl/terms` → 'pl'; diğerleri → 'tr'. */
export function localeFromPath(pathname: string): Locale {
  const seg = pathname.split('/')[1]
  return (LOCALES as string[]).includes(seg) ? (seg as Locale) : DEFAULT_LOCALE
}

/** Dil önekini soyup dilden bağımsız yolu döner: `/pl/terms` → `/terms`. */
export function stripLocale(pathname: string): string {
  const locale = localeFromPath(pathname)
  if (locale === DEFAULT_LOCALE) return pathname || '/'
  const rest = pathname.slice(`/${locale}`.length)
  return rest || '/'
}

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

/** Aktif dilin sözlüğü. */
export function useT(): Dict {
  return DICTS[useLocale()]
}

/** Aktif dile göre yol çözen yardımcı (bileşenlerde `href(...)` olarak kullanılır). */
export function useHref(): (href: string) => string {
  const locale = useLocale()
  return (h: string) => localeHref(locale, h)
}

export type { Dict } from './types'
