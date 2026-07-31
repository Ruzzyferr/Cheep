import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { useLocale } from '../../i18n'
import { formatNumber } from '../../lib/format'

/**
 * Görünür olunca 0 → `to` sayar. Sayı aktif dile göre biçimlenir
 * (tr-TR "55.000", pl-PL "55 000").
 *
 * İlk render'da (ve prerender çıktısında) **son değer** basılır: prerender
 * edilmiş HTML'de arama motorunun ve JS'siz ziyaretçinin gerçek sayıyı görmesi
 * gerekiyor. Animasyon mount sonrası yine 0'dan başlar.
 */
export function CountUp({
  to,
  duration = 2,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  to: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const locale = useLocale()

  const fmt = (v: number) => prefix + formatNumber(locale, v, decimals) + suffix

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fmt(to)
      return
    }

    let done = false
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !done) {
            done = true
            const obj = { v: 0 }
            gsap.to(obj, {
              v: to,
              duration,
              ease: 'power2.out',
              onUpdate: () => {
                el.textContent = fmt(obj.v)
              },
            })
            io.disconnect()
          }
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, duration, decimals, prefix, suffix, locale])

  return (
    <span ref={ref} className={className}>
      {fmt(to)}
    </span>
  )
}
