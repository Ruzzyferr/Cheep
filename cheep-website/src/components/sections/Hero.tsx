import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HeroCanvas } from '../canvas/HeroCanvas'

gsap.registerPlugin(ScrollTrigger)
import { CheepBird } from '../brand/CheepBird'

const TICKER = [
  ['Süt 1L', 'A101 ₺28,50', 'Migros ₺31,00', 'ŞOK ₺27,90'],
  ['Yumurta 10’lu', 'BİM ₺54,90', 'A101 ₺57,50', 'CarrefourSA ₺59,00'],
  ['Zeytinyağı 1L', 'ŞOK ₺289', 'Migros ₺319', 'A101 ₺299'],
  ['Ekmek', 'Halk ₺7,50', 'A101 ₺8,00', 'BİM ₺7,90'],
  ['Çay 1kg', 'BİM ₺189', 'ŞOK ₺199', 'Migros ₺214'],
]

export function Hero() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.hero-eyebrow', { y: 20, opacity: 0, duration: 0.6 })
        .from(
          '.hero-word',
          { yPercent: 115, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'power4.out' },
          '-=0.3',
        )
        .from('.hero-sub', { y: 24, opacity: 0, duration: 0.7 }, '-=0.5')
        .from('.hero-cta', { y: 20, opacity: 0, duration: 0.6, stagger: 0.1 }, '-=0.4')
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
    return () => ctx.revert()
  }, [])

  return (
    <section id="top" ref={root} className="relative min-h-[100svh] overflow-hidden">
      {/* CSS fallback behind the canvas — WebGL takılırsa siyah değil bu görünür */}
      <div className="absolute inset-0 bg-gradient-to-br from-cream via-mint-soft/60 to-clementine/10" />
      <HeroCanvas className="!absolute inset-0" />
      {/* legibility wash — only a soft bottom fade into the ticker */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-cream" />

      <div className="container-cheep relative z-10 grid min-h-[100svh] grid-cols-1 items-center gap-8 pt-28 pb-24 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left: copy */}
        <div className="hero-copy max-w-2xl">
          <p className="hero-eyebrow eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-forest/20 bg-paper/60 px-4 py-2 text-forest-deep backdrop-blur">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-clementine" />
            Türkiye’de canlı · 5 ülke
          </p>

          <h1 className="text-hero font-display font-bold text-ink">
            <span className="block overflow-hidden">
              <span className="hero-word inline-block">Aynı ürün.</span>
            </span>
            <span className="block overflow-hidden">
              <span className="hero-word text-gradient-clementine inline-block">En ucuz fiyat.</span>
            </span>
          </h1>

          <p className="hero-sub mt-7 max-w-xl text-lg text-ink-soft md:text-xl">
            Cheep, marketlerin fiyatlarını tek tek karşılaştırır; alışveriş listeni en
            uygun sepete taşır. Her hafta güncellenen gerçek fiyatlarla, hiç düşünmeden tasarruf et.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#download"
              className="hero-cta group inline-flex items-center gap-2 rounded-full bg-clementine px-7 py-4 text-base font-semibold text-white shadow-clementine transition-transform duration-300 hover:-translate-y-0.5"
            >
              Uygulamayı indir
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
            <a
              href="#how"
              className="hero-cta inline-flex items-center gap-2 rounded-full border border-forest/25 bg-paper/70 px-7 py-4 text-base font-semibold text-forest-deep backdrop-blur transition-colors hover:bg-mint-soft"
            >
              Nasıl çalışır?
            </a>
          </div>
        </div>

        {/* Right: mascot */}
        <div className="hero-bird relative hidden justify-self-center lg:flex">
          <div className="animate-float-slow">
            <CheepBird size={340} expression="happy" />
          </div>
          {/* floating price tags around the bird — kept clear of the face */}
          <div className="absolute -left-10 top-2 rotate-[-8deg] rounded-2xl bg-paper px-4 py-2 font-mono text-sm font-bold text-forest shadow-lift">
            ₺27,90 <span className="text-mint-500">✓ en ucuz</span>
          </div>
          <div className="absolute -left-4 bottom-6 rotate-[5deg] rounded-2xl bg-forest px-4 py-2 font-mono text-sm font-bold text-cream shadow-lift">
            %18 tasarruf
          </div>
        </div>
      </div>

      {/* Price ticker */}
      <div className="hero-ticker absolute inset-x-0 bottom-0 z-10 border-t border-line/70 bg-paper/70 py-3 backdrop-blur">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-sm">
          {[...TICKER, ...TICKER].map((row, i) => (
            <span key={i} className="flex items-center gap-3 text-ink-soft">
              <span className="font-bold text-ink">{row[0]}</span>
              {row.slice(1).map((cell, j) => (
                <span
                  key={j}
                  className={j === row.length - 2 ? 'font-bold text-mint-500' : ''}
                >
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
