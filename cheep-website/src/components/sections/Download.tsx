import { Reveal } from '../ui/Reveal'
import { CheepBird } from '../brand/CheepBird'
import { useT } from '../../i18n'
import { StoreBadges } from '../ui/StoreBadges'

export function Download() {
  const t = useT()

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

              {/* İKİ RESMİ ROZET, AYNI GÖRÜNEN YÜKSEKLİKTE.
                  `--rozet-h` GÖRÜNEN rozet yüksekliği; Play görseli kendi
                  şeffaf payı kadar büyütülüyor (bkz. PLAY_BADGE_FILL), Apple
                  rozeti payı olmadığı için doğrudan o yüksekliği alıyor.
                  Böylece ikisi yan yana eşit duruyor ve hiçbir dosya
                  değiştirilmiyor. */}
              <StoreBadges className="mt-10 justify-center [--rozet-h:44px] md:[--rozet-h:52px]" />

              <p className="mt-8 font-mono text-xs text-cream/65">{t.download.note}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
