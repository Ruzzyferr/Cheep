import type { HistoryPoint } from '../../data/types'

/**
 * 28 günlük fiyat seyri — satır içi SVG, kütüphane yok.
 *
 * Recharts/Chart.js gibi bir paket eklemek bu iş için ~50 KB JS demekti;
 * sayfa başına tek bir çizgi çizmek için bu takas saçma. Ayrıca prerender
 * edilmiş HTML'de grafik hazır geliyor — JS beklemeden görünüyor.
 *
 * Eksen ve ızgara yok: burada amaç kesin okuma değil, "fiyat düşüyor mu
 * çıkıyor mu" sorusuna bir bakışta cevap. Kesin sayılar zaten tabloda.
 */
export function Sparkline({
  history,
  width = 320,
  height = 64,
  label,
}: {
  history: HistoryPoint[]
  width?: number
  height?: number
  label: string
}) {
  // Tek nokta bir seyir değildir; çizecek bir şey yoksa hiç gösterme.
  if (history.length < 2) return null

  const values = history.map((h) => h.min)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 4

  const x = (i: number) => pad + (i / (history.length - 1)) * (width - pad * 2)
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)

  const line = history.map((h, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(h.min).toFixed(1)}`).join(' ')
  const area = `${line} L${x(history.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`

  const first = values[0]
  const last = values[values.length - 1]
  const rising = last > first
  const stroke = rising ? 'var(--color-clementine)' : 'var(--color-mint-deep)'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <path d={area} fill={stroke} opacity="0.08" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(history.length - 1)} cy={y(last)} r="3.5" fill={stroke} />
    </svg>
  )
}
