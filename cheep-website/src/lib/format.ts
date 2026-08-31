import type { Locale } from '../i18n'

/**
 * Sayı biçimlendirme — bilinçli olarak `Intl.NumberFormat` KULLANMIYOR.
 *
 * Node (prerender) ile tarayıcı farklı ICU sürümleri taşıyor: Lehçe binlik
 * ayıracı için Node U+00A0, Chromium U+202F üretiyordu. Prerender edilmiş HTML
 * ile istemci render'ı bu yüzden birebir tutmuyor ve React hydration'ı
 * düşürüyordu (#418). Ayıraçları kendimiz seçince çıktı her ortamda aynı.
 */
// Binlik ve ondalik ayiraclari ELLE secili (yukaridaki nota bkz: Intl,
// prerender ile istemci arasinda hydration farki uretiyordu).
//   tr 1.234,56 · pl 1 234,56 · hr 1.234,56 · hu 1 234,56 · ro 1.234,56
// pl ve hu ayiraci BOLUNMEZ BOSLUK (U+00A0) — sayinin satir sonunda
// bolunmesini engelliyor.
//   en 1,234.56 — TEK ayrik dil: digerlerinin hepsi ondalik VIRGUL
//   kullaniyor, Ingilizce nokta. Tabloya bakip 'hepsi ayni' diye
//   gecmek burada yanlis fiyat gostermek demek.
const GROUP: Record<Locale, string> = { tr: '.', en: ',', pl: ' ', hr: '.', hu: ' ', ro: '.' }
const DECIMAL: Record<Locale, string> = { tr: ',', en: '.', pl: ',', hr: ',', hu: ',', ro: ',' }

export function formatNumber(locale: Locale, value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals)
  const [int, frac] = fixed.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP[locale])
  const sign = value < 0 ? '-' : ''
  return sign + (frac ? `${grouped}${DECIMAL[locale]}${frac}` : grouped)
}
