import { useEffect } from 'react'

/**
 * Lenis smooth-scroll, GSAP ticker'ına bağlanır ki ScrollTrigger senkron kalsın.
 * Uygulama başına tek örnek (App'te mount edilir). Reduced-motion'a saygılı.
 *
 * Lenis ve ScrollTrigger dinamik import edilir: ikisi de yüklenirken document'e
 * dokunuyor (prerender Node ortamında import edilmemeliler) ve ilk bundle'dan
 * çıkınca sayfa daha erken boyanıyor.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cancelled = false
    let dispose: (() => void) | undefined

    void Promise.all([import('lenis'), import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
        if (cancelled) return
        gsap.registerPlugin(ScrollTrigger)

        const lenis = new Lenis({
          duration: 1.15,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          touchMultiplier: 1.6,
        })

        lenis.on('scroll', ScrollTrigger.update)

        const raf = (time: number) => lenis.raf(time * 1000)
        gsap.ticker.add(raf)
        gsap.ticker.lagSmoothing(0)

        dispose = () => {
          gsap.ticker.remove(raf)
          lenis.destroy()
        }
      },
    )

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [])
}
