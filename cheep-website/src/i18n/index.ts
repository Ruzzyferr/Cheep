import { createContext, useContext } from 'react'
import type { Dict } from './types'
import { tr } from './tr'
import { en } from './en'
import { pl } from './pl'
import { hr } from './hr'
import { hu } from './hu'
import { ro } from './ro'

export type Locale = 'tr' | 'en' | 'pl' | 'hr' | 'hu' | 'ro'

export const LOCALES: Locale[] = ['tr', 'en', 'pl', 'hr', 'hu', 'ro']
export const DEFAULT_LOCALE: Locale = 'tr'

export const DICTS: Record<Locale, Dict> = { tr, en, pl, hr, hu, ro }

/**
 * Dilin KENDİ adı, kendi dilinde.
 *
 * Dil seçicide her seçenek daima kendi dilinde yazılır ("Magyar", "Hrvatski")
 * — arayüzü anlamayan bir kullanıcı kendi dilini ancak böyle bulabilir, ki
 * seçicinin varlık sebebi tam olarak o durumdur. Bu yüzden tablo çeviri
 * sözlüklerinde DEĞİL, dilden bağımsız olarak burada duruyor: aksi hâlde beş
 * sözlüğün her biri diğer dört dilin adını tekrar yazardı (20 girdi, hepsi
 * ayrışmaya açık).
 */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  pl: 'Polski',
  hr: 'Hrvatski',
  hu: 'Magyar',
  ro: 'Română',
}

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
