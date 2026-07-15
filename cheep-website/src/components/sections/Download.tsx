import { Reveal } from '../ui/Reveal'
import { CheepBird } from '../brand/CheepBird'

export function Download() {
  return (
    <section id="download" className="relative bg-cream py-24 md:py-32">
      <div className="container-cheep">
        <Reveal>
          <div className="relative overflow-hidden rounded-[40px] bg-forest-deep px-8 py-16 text-center text-cream md:px-16 md:py-24">
            {/* glows */}
            <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-mint/25 blur-[110px]" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-clementine/25 blur-[120px]" />

            <div className="relative">
              <div className="mb-6 flex justify-center">
                <div className="animate-float-slow">
                  <CheepBird size={130} expression="celebrate" />
                </div>
              </div>
              <h2 className="mx-auto max-w-3xl text-section text-cream">
                Bir sonraki sepetin <span className="text-gradient-clementine">daha ucuz</span> olsun
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-cream/70">
                Cheep’i indir, listeni oluştur, tasarrufu gör. Türkiye ve Polonya’da ücretsiz.
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <a
                  href="#"
                  className="inline-flex items-center gap-3 rounded-2xl bg-cream px-6 py-4 text-left text-ink shadow-lift transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <span className="text-2xl">▶</span>
                  <span>
                    <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-ink-soft">Yakında</span>
                    <span className="block font-display text-lg font-bold leading-tight">Google Play</span>
                  </span>
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-3 rounded-2xl border border-cream/25 px-6 py-4 text-left text-cream transition-colors hover:bg-cream/10"
                >
                  <span className="text-2xl"></span>
                  <span>
                    <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-cream/60">Yakında</span>
                    <span className="block font-display text-lg font-bold leading-tight">App Store</span>
                  </span>
                </a>
              </div>

              <p className="mt-8 font-mono text-xs text-cream/50">
                APK’yı doğrudan indirmek için bize yaz · destek@cheep.live
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
