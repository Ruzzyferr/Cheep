import type { Locale } from '../i18n'

/**
 * Sayı biçimlendirme — bilinçli olarak `Intl.NumberFormat` KULLANMIYOR.
 *
 * Node (prerender) ile tarayıcı farklı ICU sürümleri taşıyor: Lehçe binlik
 * ayıracı için Node U+00A0, Chromium U+202F üretiyordu. Prerender edilmiş HTML
 * ile istemci render'ı bu yüzden birebir tutmuyor ve React hydration'ı
 * düşürüyordu (#418). Ayıraçları kendimiz seçince çıktı her ortamda aynı.
 */
const GROUP: Record<Locale, string> = { tr: '.', pl: ' ' }
const DECIMAL: Record<Locale, string> = { tr: ',', pl: ',' }

export function formatNumber(locale: Locale, value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals)
  const [int, frac] = fixed.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP[locale])
  const sign = value < 0 ? '-' : ''
  return sign + (frac ? `${grouped}${DECIMAL[locale]}${frac}` : grouped)
}
