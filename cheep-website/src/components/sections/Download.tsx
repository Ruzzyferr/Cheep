import { Reveal } from '../ui/Reveal'
import { CheepBird } from '../brand/CheepBird'
import { useT, useLocale } from '../../i18n'
import { PLAY_URL } from '../../config'

export function Download() {
  const t = useT()
  const locale = useLocale()

  return (
    <section id="download" className="relative bg-cream py-20 md:py-32">
      <div className="container-cheep">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-forest-deep px-6 py-14 text-center text-cream md:rounded-[40px] md:px-16 md:py-24">
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
                {t.download.titleLead}{' '}
                <span className="text-gradient-clementine">{t.download.titleAccent}</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-cream/70">{t.download.sub}</p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                {/* Resmi Google Play rozeti — Google'ın marka kılavuzu gereği asset
                    değiştirilmeden, dile göre yerelleştirilmiş sürümüyle kullanılır. */}
                <a
                  href={PLAY_URL}
                  target="_blank"
                  rel="noopener"
                  className="inline-block rounded-xl transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <img
                    src={`/playbadge-${locale}.png`}
                    alt={t.download.playAlt}
                    width={440}
                    height={170}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-[200px] md:w-[220px]"
                  />
                </a>

                <span
                  aria-disabled="true"
                  className="inline-flex cursor-default items-center gap-3 rounded-2xl border border-cream/25 px-6 py-4 text-left text-cream/60"
                >
                  <span aria-hidden className="text-2xl"></span>
                  <span>
                    <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-cream/65">
                      {t.download.storeTop}
                    </span>
                    <span className="block font-display text-lg font-bold leading-tight">
                      {t.download.storeBottom}
                    </span>
                  </span>
                </span>
              </div>

              <p className="mt-8 font-mono text-xs text-cream/65">{t.download.note}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
