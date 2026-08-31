import { useLocale, useT } from '../../i18n'
import { APP_STORE_URL, PLAY_URL } from '../../config'

/** Play rozeti GERÇEKTEN var olan diller (public/playbadge-*.png). */
const PLAY_BADGE_LOCALES = new Set<string>(['tr', 'pl', 'hr', 'hu', 'ro'])

/**
 * App Store rozeti olan diller (public/appstorebadge-*.svg).
 *
 * HIRVATÇA YOK — Apple Hırvatça rozet YAYIMLAMIYOR; `hr` bilerek İngilizce
 * rozete düşüyor. Bu bir eksiklik değil, Apple'ın kendi kuralı: rozetin
 * bulunmadığı dilde İngilizcesi kullanılır. Buraya 'hr' eklemek dosya
 * olmadığı için kırık görsel bırakır.
 *
 * YEDEK ŞART: iki listedeki her dilin dosyası public/ altında GERÇEKTEN
 * olmalı. Yeni dil eklenip rozet dosyası unutulduğunda 404 dönüyor ve bu
 * tam olarak yaşandı: hr/hu/ro eklendi, Play rozetleri eklenmedi, üç dilde
 * de indirme bölümünün ortasında kırık görsel kaldı.
 */
const APPLE_BADGE_LOCALES = new Set<string>(['tr', 'pl', 'hu', 'ro'])

/**
 * Google'ın rozet DOSYASININ ne kadarı gerçekten rozet.
 *
 * Play rozetleri şeffaf bir "temiz alan" payıyla geliyor, Apple'ınkiler ise
 * kutuyu tamamen dolduruyor. İkisine aynı yüksekliği vermek bu yüzden
 * çalışmaz: Play rozeti gözle görülür biçimde KÜÇÜK kalır.
 *
 * Sayılar dosyaların alfa kanalından ölçüldü (31 Ağu 2026); dil başına
 * değişiyorlar çünkü Google rozetleri farklı tuvallerde yayımlamış:
 * tr/pl 440x170 (pay 17px), hr/hu/ro 646x250 (pay 29px), en ise dört
 * yanında 41px payla geliyor.
 *
 * Play görselinin yüksekliği hedef/oran olarak veriliyor, böylece GÖRÜNEN
 * rozet tam olarak hedef yüksekliğinde çıkıyor. Dosyalara dokunulmuyor —
 * Google'ın marka kılavuzu rozeti değiştirmeyi yasaklıyor.
 */
const PLAY_BADGE_FILL: Record<string, number> = {
  tr: 0.8,
  pl: 0.8,
  hr: 0.768,
  hu: 0.768,
  ro: 0.768,
  en: 0.672,
}

interface Props {
  /**
   * GÖRÜNEN rozet yüksekliği. Tailwind'in duyarlı sınıfları burada
   * çalışmadığı için CSS değişkeni olarak veriliyor; çağıran taraf
   * `[--rozet-h:44px] md:[--rozet-h:52px]` yazabilsin diye.
   */
  className?: string
}

/**
 * İKİ MAĞAZANIN RESMİ ROZETİ, AYNI GÖRÜNEN YÜKSEKLİKTE.
 *
 * Tek bileşen: indirme bölümü ve ürün sayfaları aynı rozetleri gösteriyor.
 * Ayrı ayrı yazılsalardı `PLAY_BADGE_FILL` iki yerde durur ve biri
 * güncellenip diğeri unutulurdu.
 */
export function StoreBadges({ className = '' }: Props) {
  const t = useT()
  const locale = useLocale()

  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`}>
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
          style={{ height: `calc(var(--rozet-h) / ${PLAY_BADGE_FILL[locale] ?? PLAY_BADGE_FILL.en})` }}
        />
      </a>

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
  )
}
