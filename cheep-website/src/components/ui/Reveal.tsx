import { useRef, useEffect, type ReactNode } from 'react'
import { gsap } from 'gsap'

/**
 * Scroll-triggered reveal via IntersectionObserver (scroll-driver bağımsız,
 * ScrollTrigger+Lenis'in bayat-pozisyon sorununa dayanıklı). `stagger` ile
 * doğrudan çocukları sırayla açar. Reduced-motion'da içerik anında görünür.
 */
export function Reveal({
  children,
  className,
  stagger = false,
  y = 44,
  threshold = 0.15,
}: {
  children: ReactNode
  className?: string
  stagger?: boolean
  y?: number
  threshold?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const targets: Element[] = stagger ? Array.from(el.children) : [el]
    gsap.set(targets, { opacity: 0, y })

    let done = false
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !done) {
            done = true
            gsap.to(targets, {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: 'power3.out',
              stagger: stagger ? 0.11 : 0,
            })
            io.disconnect()
          }
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [stagger, y, threshold])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
