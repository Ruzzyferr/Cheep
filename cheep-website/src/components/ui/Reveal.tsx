import { useRef, useEffect, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll-triggered reveal. Animates itself on enter; with `stagger`, animates
 * its direct children in sequence. Respects reduced-motion (no-op).
 */
export function Reveal({
  children,
  className,
  stagger = false,
  y = 44,
  start = 'top 82%',
}: {
  children: ReactNode
  className?: string
  stagger?: boolean
  y?: number
  start?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      const targets = stagger ? (ref.current!.children as unknown as Element[]) : ref.current!
      gsap.from(targets, {
        y,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: stagger ? 0.11 : 0,
        scrollTrigger: { trigger: ref.current, start },
      })
    }, ref)
    return () => ctx.revert()
  }, [stagger, y, start])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
