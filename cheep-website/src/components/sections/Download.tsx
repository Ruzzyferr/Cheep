import { Reveal } from '../ui/Reveal'
import { CheepBird } from '../brand/CheepBird'
import { useT, useLocale } from '../../i18n'
import { APP_STORE_URL, PLAY_URL } from '../../config'

/** Play rozeti GERÇEKTEN var olan diller (public/playbadge-*.png). */
const PLAY_BADGE_LOCALES = new Set<string>(['tr', 'pl', 'hr', 'hu', 'ro'])

/**
 * App Store rozeti olan diller (public/appstorebadge-*.svg).
 *
 * HIRVATÇA YOK — Apple Hırvatça rozet YAYIMLAMIYOR; `hr` bilerek İngilizce
 * rozete düşüyor. Bu bir eksiklik değil, Apple'ın kendi kuralı: rozetin
 * bulunmadığı dilde İngilizcesi kullanılır. Buraya 'hr' eklemek dosya
 * olmadığı için indirme bölümünün ortasında kırık görsel bırakır.
 */
const APPLE_BADGE_LOCALES = new Set<string>(['tr', 'pl', 'hu', 'ro'])

/**
 * Google'ın rozet DOSYASININ ne kadarı gerçekten rozet.
 *
 * Play rozetleri şeffaf bir "temiz alan" payıyla geliyor, Apple'ınkiler ise
 * kutuyu tamamen dolduruyor. İkisine aynı yüksekliği vermek bu yüzden
 * çalışmaz: Play rozeti gözle görülür biçimde KÜÇÜK kalır — asıl şikâyet
 * konusu olan "derme çatma" görüntü tam olarak budur.
 *
 * Sayılar dosyaların alfa kanalından ölçüldü (31 Ağu 2026); dil başına
 * değişiyorlar çünkü Google rozetleri farklı tuvallerde yayımlamış:
 * tr/pl 440x170 (pay 17px), hr/hu/ro 646x250 (pay 29px), en ise dört
 * yanında 41px payla geliyor.
 *
 * Kullanımı: Play görselinin yüksekliği hedef/oran olarak veriliyor, böylece
 * GÖRÜNEN rozet tam olarak hedef yüksekliğinde çıkıyor. Dosyalara
 * dokunulmuyor — Google'ın marka kılavuzu rozeti değiştirmeyi yasaklıyor.
 */
const PLAY_BADGE_FILL: Record<string, number> = {
  tr: 0.8,
  pl: 0.8,
  hr: 0.768,
  hu: 0.768,
  ro: 0.768,
  en: 0.672,
}

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

              {/* İKİ RESMİ ROZET, AYNI GÖRÜNEN YÜKSEKLİKTE.
                  `--rozet-h` GÖRÜNEN rozet yüksekliği; Play görseli kendi
                  şeffaf payı kadar büyütülüyor (bkz. PLAY_BADGE_FILL), Apple
                  rozeti payı olmadığı için doğrudan o yüksekliği alıyor.
                  Böylece ikisi yan yana eşit duruyor ve hiçbir dosya
                  değiştirilmiyor. */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4 [--rozet-h:44px] md:[--rozet-h:52px]">
                {/* Resmi Google Play rozeti — Google'ın marka kılavuzu gereği asset
                    değiştirilmeden, dile göre yerelleştirilmiş sürümüyle kullanılır.

                    YEDEK ŞART: rozet dosyası dile göre adlandırılıyor
                    (`playbadge-<locale>.png`) ve yeni bir dil eklendiğinde
                    dosyayı koymayı unutmak KIRIK GÖRSEL bırakıyor — indirme
                    bölümünün tam ortasında, yani dönüşümün en kritik yerinde.
                    Tam olarak bu yaşandı: hr/hu/ro eklendi, rozetleri
                    eklenmedi ve üç dilde de 404 döndü. `PLAY_BADGE_LOCALES`
                    bilinen dosyaları listeliyor; listede olmayan dil İngilizce
                    rozete düşüyor (Google'ın kendi yayınladığı asset). */}
                <a
                  href={PLAY_URL}
                  target="_blank"
                  rel="noopener"
                  aria-label={t.download.playAlt}
                  className="inline-block transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <img
                    src={`/playbadge-${PLAY_BADGE_LOCALES.has(locale) ? locale : 'en'}.png`}
                    alt={t.download.playAlt}
                    loading="lazy"
                    decoding="async"
                    className="w-auto max-w-none"
                    style={{
                      height: `calc(var(--rozet-h) / ${PLAY_BADGE_FILL[locale] ?? PLAY_BADGE_FILL.en})`,
                    }}
                  />
                </a>

                {/* Resmi Apple rozeti (siyah sürüm — Play rozeti de siyah, ikisi
                    koyu zeminde birlikte duruyor).

                    iOS uzun süre "Yakında" yazan, TIKLANAMAYAN bir <span>'di:
                    uygulama beş mağazada yayına girdikten sonra bile öyle kaldı
                    ve indirme bölümünün ortasında iPhone kullanıcısına "bizde
                    yok" dedi. Sonra gerçek bağlantı oldu ama elde çizilmiş bir
                    kutuydu; Play'in resmi rozetinin yanında derme çatma
                    duruyordu. Artık Apple'ın kendi yayımladığı rozet. */}
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener"
                  aria-label={t.download.appStoreAlt}
                  className="inline-block transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <img
                    src={`/appstorebadge-${APPLE_BADGE_LOCALES.has(locale) ? locale : 'en'}.svg`}
                    alt={t.download.appStoreAlt}
                    loading="lazy"
                    decoding="async"
                    className="w-auto max-w-none"
                    style={{ height: 'var(--rozet-h)' }}
                  />
                </a>
              </div>

              <p className="mt-8 font-mono text-xs text-cream/65">{t.download.note}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
