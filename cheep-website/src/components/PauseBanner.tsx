import { useContext } from 'react'
import { LocaleContext, type Locale } from '../i18n'

/**
 * Duraklatma bildirimi — her sayfanın en üstünde.
 *
 * NEDEN VAR: 5 Eki 2026'da uygulama iki mağazadan da geri çekildi ve sunucu
 * kapatıldı. Site ücretsiz statik barındırmada yayında kalıyor; alan adı,
 * gizlilik/koşullar sayfaları ve Search Console doğrulaması böyle korunuyor.
 *
 * Bildirim OLMADAN bu site yanıltıcı olurdu: "indir" düğmeleri artık var
 * olmayan mağaza sayfalarına gidiyor. Ziyaretçiye durumu ilk ekranda, tek
 * cümleyle söylemek, kırık bir bağlantıya tıklatmaktan dürüst.
 *
 * Metinler burada GÖMÜLÜ, i18n sözlüğünde değil: bu geçici bir durum ve
 * kaldırılırken tek dosya silinecek — sözlüğe dağıtılmış anahtar bırakmıyor.
 */
const METIN: Record<Locale, { baslik: string; govde: string }> = {
  tr: {
    baslik: 'Cheep şu anda duraklatıldı',
    govde:
      'Veri kullanımına ilişkin resmî başvurumuz sonuçlanana kadar uygulama mağazalardan geri çekildi. Uygulamayı daha önce indirdiyseniz listeleriniz cihazınızda duruyor.',
  },
  en: {
    baslik: 'Cheep is paused for now',
    govde:
      'The app has been withdrawn from both stores while our official data-use application is pending. If you already installed it, your lists remain on your device.',
  },
  pl: {
    baslik: 'Cheep jest obecnie wstrzymany',
    govde:
      'Aplikacja została wycofana ze sklepów na czas rozpatrywania naszego oficjalnego wniosku o wykorzystanie danych. Jeśli masz ją zainstalowaną, Twoje listy pozostają na urządzeniu.',
  },
  hr: {
    baslik: 'Cheep je trenutno pauziran',
    govde:
      'Aplikacija je povučena iz trgovina dok se rješava naš službeni zahtjev za korištenje podataka. Ako ste je već instalirali, vaši popisi ostaju na uređaju.',
  },
  hu: {
    baslik: 'A Cheep jelenleg szünetel',
    govde:
      'Az alkalmazást visszavontuk mindkét áruházból, amíg hivatalos adatfelhasználási kérelmünk elbírálás alatt áll. Ha már telepítetted, a listáid megmaradnak az eszközödön.',
  },
  ro: {
    baslik: 'Cheep este momentan în pauză',
    govde:
      'Aplicația a fost retrasă din magazine până la soluționarea cererii noastre oficiale privind utilizarea datelor. Dacă ai instalat-o deja, listele tale rămân pe dispozitiv.',
  },
}

export function PauseBanner() {
  const locale = useContext(LocaleContext)
  const t = METIN[locale] ?? METIN.en

  return (
    <div role="status" style={kap}>
      <strong style={baslikStil}>{t.baslik}</strong>
      <span style={govdeStil}>{t.govde}</span>
    </div>
  )
}

const kap: React.CSSProperties = {
  background: '#0f3a29',
  color: '#e8f7ef',
  padding: '14px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  alignItems: 'center',
  textAlign: 'center',
  fontSize: 14,
  lineHeight: 1.5,
  borderBottom: '1px solid rgba(87,201,154,.35)',
}
const baslikStil: React.CSSProperties = { fontWeight: 700 }
const govdeStil: React.CSSProperties = { opacity: 0.88, maxWidth: 760 }
