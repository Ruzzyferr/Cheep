import type { Locale } from '../i18n'
import { formatNumber } from './format'

/**
 * Para biçimlendirme. `Intl.NumberFormat` bilinçli kullanılmıyor — gerekçe
 * `format.ts` başında: Node ve Chromium farklı ICU sürümleri taşıyor ve
 * prerender ile hydration birbirini tutmuyordu.
 */
const SYMBOL: Record<string, string> = { TRY: '₺', PLN: 'zł', EUR: '€', SEK: 'kr', CHF: 'CHF' }

/** Sembol önde mi arkada mı — Lehçe'de "12,99 zł", Türkçe'de "₺12,99". */
const SUFFIX_CURRENCIES = new Set(['PLN', 'SEK'])

export function formatMoney(locale: Locale, currency: string, value: number): string {
  const symbol = SYMBOL[currency] ?? currency
  const n = formatNumber(locale, value, 2)
  return SUFFIX_CURRENCIES.has(currency) ? `${n} ${symbol}` : `${symbol}${n}`
}

/** Yüzde — ondalık göstermiyoruz, "%38" "%37,6"dan daha okunur. */
export function formatPct(locale: Locale, value: number): string {
  const n = formatNumber(locale, Math.round(value), 0)
  return locale === 'tr' ? `%${n}` : `${n}%`
}

/**
 * Tarihi "3 gün önce" gibi göreli ifadeye çevirir.
 * `Intl.RelativeTimeFormat` yerine elle: aynı ICU gerekçesi.
 */
export function formatAge(locale: Locale, iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return locale === 'tr' ? 'bugün' : 'dzisiaj'
  if (days === 1) return locale === 'tr' ? 'dün' : 'wczoraj'
  return locale === 'tr' ? `${days} gün önce` : `${days} dni temu`
}
