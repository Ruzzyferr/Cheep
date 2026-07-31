import { useEffect, useRef, lazy, Suspense } from 'react'
import { gsap } from 'gsap'
import { CheepBird } from '../brand/CheepBird'
import { useT } from '../../i18n'
import { useIsDesktop } from '../../lib/hooks'

/**
 * WebGL aurora yalnızca masaüstünde ve yalnızca istemcide yüklenir:
 *  - prerender sırasında hiç render edilmez (SSR'da WebGL yok),
 *  - three.js ana bundle'dan çıkar (ayrı chunk),
 *  - mobilde hiç indirilmez. Dar portre ekranda shader'ın renk lekeleri metnin
 *    arkasına düşüp okunabilirliği bozuyordu; scrim'i masaüstü düzenine göre
 *    ayarlı. Mobilde altındaki CSS gradyanı görünür — hem okunur hem hızlı.
 */
const HeroCanvas = lazy(() =>
  import('../canvas/HeroCanvas').then((m) => ({ default: m.HeroCanvas })),
)

export function Hero() {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    let ctx: gsap.Context | undefined
    let cancelled = false

    // ScrollTrigger dinamik yüklenir: modül yüklenirken document'e dokunuyor,
    // prerender (Node) ortamında import edilmemeli.
    void import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)

      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.from('.hero-eyebrow', { y: 20, opacity: 0, duration: 0.6 })
          .from(
            '.hero-word',
            { yPercent: 115, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power4.out' },
            '-=0.3',
          )
          .from('.hero-sub', { y: 24, opacity: 0, duration: 0.7 }, '-=0.5')
          .from('.hero-ctas', { y: 20, opacity: 0, duration: 0.6 }, '-=0.4')
          .from('.hero-bird', { scale: 0.6, opacity: 0, duration: 1, ease: 'back.out(1.7)' }, '-=0.9')
          .from('.hero-ticker', { y: 30, opacity: 0, duration: 0.7 }, '-=0.6')

        // scroll-linked parallax (igloo-style): layers drift at different rates
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (!reduce) {
          const st = { trigger: root.current!, start: 'top top', end: 'bottom top', scrub: 0.6 }
          gsap.to('.hero-bird', { yPercent: -22, ease: 'none', scrollTrigger: st })
          gsap.to('.hero-copy', { yPercent: 14, opacity: 0.55, ease: 'none', scrollTrigger: st })
          gsap.to('.hero-ticker', { yPercent: 40, ease: 'none', scrollTrigger: st })
        }
      }, root)
    })

    return () => {
      cancelled = true
      ctx?.revert()
    }
  }, [])

  return (
    <section id="top" ref={root} className="relative min-h-[100svh] overflow-hidden">
      {/* CSS fallback behind the canvas — WebGL takılırsa (ve mobilde) bu görünür */}
      <div className="absolute inset-0 bg-gradient-to-br from-cream via-mint-soft/60 to-clementine/10" />
      {isDesktop && (
        <Suspense fallback={null}>
          <HeroCanvas className="!absolute inset-0" />
        </Suspense>
      )}
      {/* legibility wash — only a soft bottom fade into the ticker */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-cream" />

      <div className="container-cheep relative z-10 grid min-h-[100svh] grid-cols-1 items-center gap-8 pt-28 pb-36 md:pb-32 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left: copy */}
        <div className="hero-copy max-w-2xl">
          <p className="hero-eyebrow eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-forest/20 bg-paper/70 px-4 py-2 text-forest-deep backdrop-blur">
            <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-clementine" />
            {t.hero.badge}
          </p>

          <h1 className="text-hero font-display font-bold text-ink">
            <span className="block overflow-hidden">
              <span className="hero-word inline-block">{t.hero.titleLine1}</span>
            </span>
            <span className="block overflow-hidden">
              <span className="hero-word text-gradient-clementine inline-block">
                {t.hero.titleLine2}
              </span>
            </span>
          </h1>

          <p className="hero-sub mt-7 max-w-xl text-lg text-ink-soft md:text-xl">{t.hero.sub}</p>

          <div className="hero-ctas mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#download"
              className="group inline-flex items-center gap-2 rounded-full border border-transparent bg-clementine-deep px-7 py-4 text-base font-semibold text-white shadow-clementine transition-transform duration-300 hover:-translate-y-0.5"
            >
              {t.hero.ctaPrimary}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-forest/25 bg-paper/80 px-7 py-4 text-base font-semibold text-forest-deep backdrop-blur transition-colors hover:bg-mint-soft"
            >
              {t.hero.ctaSecondary}
            </a>
          </div>
        </div>

        {/* Right: mascot — mobilde küçük ve fiyat etiketsiz, masaüstünde tam sahne */}
        <div className="hero-bird relative flex justify-self-center lg:justify-self-auto">
          <div className="animate-float-slow">
            <CheepBird size={340} expression="happy" className="h-auto w-[clamp(9rem,40vw,21.25rem)]" />
          </div>
          {/* floating price tags around the bird — kept clear of the face */}
          <div className="absolute -left-6 top-2 hidden rotate-[-8deg] rounded-2xl bg-paper px-4 py-2 font-mono text-sm font-bold text-forest shadow-lift lg:block">
            ₺27,90 <span className="text-mint-deep">{t.hero.tagCheapest}</span>
          </div>
          <div className="absolute -left-4 bottom-6 hidden rotate-[5deg] rounded-2xl bg-forest px-4 py-2 font-mono text-sm font-bold text-cream shadow-lift lg:block">
            {t.hero.tagSaving}
          </div>
        </div>
      </div>

      {/* Price ticker */}
      <div className="hero-ticker absolute inset-x-0 bottom-0 z-10 border-t border-line/70 bg-paper/80 py-3 backdrop-blur">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-sm">
          {[...t.hero.ticker, ...t.hero.ticker].map((row, i) => (
            <span key={i} className="flex items-center gap-3 text-ink-soft">
              <span className="font-bold text-ink">{row.product}</span>
              {row.prices.map((cell, j) => (
                <span key={j} className={j === row.prices.length - 1 ? 'font-bold text-mint-deep' : ''}>
                  {cell}
                </span>
              ))}
              <span className="text-clementine">•</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
