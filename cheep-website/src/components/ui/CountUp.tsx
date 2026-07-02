import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

/** Counts 0 → `to` when scrolled into view (IntersectionObserver). Turkish format. */
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

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fmt = (v: number) =>
      prefix +
      v.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
      suffix
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
  }, [to, duration, decimals, prefix, suffix])

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  )
}
