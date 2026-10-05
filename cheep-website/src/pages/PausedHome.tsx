import { Link } from 'react-router-dom'
import { useLocale } from '../i18n'
import { LOCALES, LOCALE_NATIVE_NAMES, localePrefix, type Locale } from '../i18n'

/**
 * Duraklatma dönemi ana sayfası.
 *
 * NEDEN VAR: 5 Eki 2026'da uygulama iki mağazadan da çekildi ve sunucu
 * kapatıldı. Eski ana sayfa "5 ülkede canlı · 120.000+ ürün", ülke başına
 * "Canlı" rozeti, 20 zincirin logosu ve "Resmi veri · düzenli güncellenir"
 * diyordu. Hiçbiri artık doğru değil — üstelik "resmi veri" ifadesi Market
 * Fiyatı'na işaret ediyordu ve o bağ bilerek koparıldı
 * (bkz. docs/VERI-IZINLERI.md).
 *
 * Otuz pazarlama iddiasını altı dilde tek tek yumuşatmak yerine ana sayfa
 * dürüst bir DURUM sayfasına çevrildi. Eski bölümler (Hero, Coverage, Faq...)
 * kodda OLDUĞU GİBİ duruyor; `Home.tsx` içindeki tek bayrak geri çevrilince
 * hepsi döner.
 *
 * "Yakında" YAZMIYOR: bu bilerek. Dönüş, bir bakanlık başvurusunun sonucuna
 * bağlı ve tarihini biz belirlemiyoruz. Tutamayacağımız bir söz vermektense
 * ne beklediğimizi yazmak daha dürüst.
 *
 * Metinler burada gömülü, i18n sözlüğünde değil — geçici bir durum, geri
 * dönerken tek dosya siliniyor.
 */
type Metin = {
  rozet: string
  baslik: string
  giris: string
  neOlduBaslik: string
  neOldu: string[]
  verinBaslik: string
  verin: string[]
  neBekliyorBaslik: string
  neBekliyor: string
  iletisim: string
  yasal: string
  gizlilik: string
  kosullar: string
  hesapSil: string
  dil: string
}

const METIN: Record<Locale, Metin> = {
  tr: {
    rozet: 'Duraklatıldı',
    baslik: 'Cheep şu anda çalışmıyor',
    giris:
      'Uygulama Google Play ve App Store’dan geri çekildi, sunucularımız kapatıldı. Bu geçici bir durum ve sebebi teknik değil: fiyat verisini hangi şartlarda kullanabileceğimizi resmî olarak sorduk, yanıtı bekliyoruz.',
    neOlduBaslik: 'Ne oldu',
    neOldu: [
      'Türkiye fiyatlarını kullandığımız kaynağın koşulları yazılı izin şartı getiriyordu. İzin başvurumuz reddedildi; yetkili merciin bakanlıklar olduğu bildirildi.',
      'Bunun üzerine o kaynaktan gelen tüm fiyat verisini uygulamadan ve sunucularımızdan kaldırdık.',
      'Diğer ülkelerin kaynaklarını da okuduk. Çoğunda aynı yasak vardı, onları da durdurduk.',
      'Elde yalnızca açıkça izin verilen tek kaynak kaldı. Tek ülkeyle devam etmek yerine, soruyu yetkili mercie sorup beklemeyi seçtik.',
    ],
    verinBaslik: 'Senin verin',
    verin: [
      'Uygulamayı indirdiysen listelerin cihazında duruyor.',
      'Ücretli abonelik satın aldıysan yeni bir tahsilat yapılmayacak. Uygulama geri çekildiği için App Store üzerinden iade talep edebilirsin; destek@cheep.live adresine yazarsan biz de yardımcı oluruz.',
      'Hesabının silinmesini istersen aşağıdaki sayfadan talep edebilirsin; sunucu kapalıyken de talebini alıyoruz.',
    ],
    neBekliyorBaslik: 'Ne bekliyoruz',
    neBekliyor:
      'Bilgi Edinme Hakkı Kanunu kapsamında bakanlığa başvurduk. Kanun 15 iş günü içinde yanıt verilmesini zorunlu kılıyor. Yanıt, bir tüketici uygulamasının bu veriyi hangi şartlarda gösterebileceğini belirleyecek. Sonucu burada paylaşacağız.',
    iletisim: 'Soru veya talep için:',
    yasal: 'Yasal',
    gizlilik: 'Gizlilik Politikası',
    kosullar: 'Kullanım Şartları',
    hesapSil: 'Hesap Silme',
    dil: 'Dil',
  },
  en: {
    rozet: 'Paused',
    baslik: 'Cheep is not running right now',
    giris:
      'The app has been withdrawn from Google Play and the App Store, and our servers are switched off. This is temporary, and the reason is not technical: we have formally asked under what conditions we may use grocery price data, and we are waiting for the answer.',
    neOlduBaslik: 'What happened',
    neOldu: [
      'The source we used for Turkish prices requires written permission in its terms. Our request was refused, and we were told the competent authority is the ministries.',
      'We then removed all price data from that source, from the app and from our servers.',
      'We also read the terms of the other countries’ sources. Most carried the same prohibition, so we stopped those too.',
      'Only one clearly permitted source was left. Rather than continue with a single country, we chose to ask the competent authority and wait.',
    ],
    verinBaslik: 'Your data',
    verin: [
      'If you installed the app, your lists are still on your device.',
      'If you bought a paid subscription, you will not be charged again. Because the app has been withdrawn, you can request a refund through the App Store; write to destek@cheep.live and we will help.',
      'If you want your account deleted, you can request it on the page below — we receive requests even while the server is off.',
    ],
    neBekliyorBaslik: 'What we are waiting for',
    neBekliyor:
      'We filed a request with the ministry under the Freedom of Information Act, which obliges a reply within 15 working days. The answer will determine the conditions under which a consumer app may show this data. We will post the outcome here.',
    iletisim: 'Questions or requests:',
    yasal: 'Legal',
    gizlilik: 'Privacy Policy',
    kosullar: 'Terms of Use',
    hesapSil: 'Delete Account',
    dil: 'Language',
  },
  pl: {
    rozet: 'Wstrzymane',
    baslik: 'Cheep obecnie nie działa',
    giris:
      'Aplikacja została wycofana z Google Play i App Store, a nasze serwery są wyłączone. To stan tymczasowy, a powód nie jest techniczny: oficjalnie zapytaliśmy, na jakich warunkach możemy korzystać z danych o cenach, i czekamy na odpowiedź.',
    neOlduBaslik: 'Co się stało',
    neOldu: [
      'Źródło, z którego korzystaliśmy dla cen w Turcji, wymaga w regulaminie pisemnej zgody. Nasz wniosek odrzucono, wskazując ministerstwa jako organ właściwy.',
      'Usunęliśmy więc wszystkie dane cenowe z tego źródła — z aplikacji i z serwerów.',
      'Przeczytaliśmy też regulaminy źródeł w pozostałych krajach. W większości obowiązywał ten sam zakaz, więc je również wstrzymaliśmy.',
      'Zostało tylko jedno wyraźnie dozwolone źródło. Zamiast działać w jednym kraju, postanowiliśmy zapytać właściwy organ i zaczekać.',
    ],
    verinBaslik: 'Twoje dane',
    verin: [
      'Jeśli masz zainstalowaną aplikację, Twoje listy pozostają na urządzeniu.',
      'Jeśli wykupiłeś płatną subskrypcję, nie pobierzemy kolejnej opłaty. Ponieważ aplikacja została wycofana, możesz poprosić o zwrot przez App Store; napisz na destek@cheep.live, a pomożemy.',
      'Jeśli chcesz usunąć konto, możesz złożyć wniosek na stronie poniżej — odbieramy zgłoszenia także przy wyłączonym serwerze.',
    ],
    neBekliyorBaslik: 'Na co czekamy',
    neBekliyor:
      'Złożyliśmy wniosek do ministerstwa w trybie dostępu do informacji publicznej, który zobowiązuje do odpowiedzi w ciągu 15 dni roboczych. Odpowiedź określi, na jakich warunkach aplikacja konsumencka może pokazywać te dane. Wynik opublikujemy tutaj.',
    iletisim: 'Pytania lub wnioski:',
    yasal: 'Informacje prawne',
    gizlilik: 'Polityka prywatności',
    kosullar: 'Warunki korzystania',
    hesapSil: 'Usunięcie konta',
    dil: 'Język',
  },
  hr: {
    rozet: 'Pauzirano',
    baslik: 'Cheep trenutno ne radi',
    giris:
      'Aplikacija je povučena s Google Playa i App Storea, a naši poslužitelji su ugašeni. Ovo je privremeno, a razlog nije tehnički: službeno smo pitali pod kojim uvjetima smijemo koristiti podatke o cijenama i čekamo odgovor.',
    neOlduBaslik: 'Što se dogodilo',
    neOldu: [
      'Izvor koji smo koristili za turske cijene u svojim uvjetima traži pisano dopuštenje. Zahtjev nam je odbijen uz obavijest da su nadležna ministarstva.',
      'Nakon toga uklonili smo sve podatke o cijenama iz tog izvora — iz aplikacije i s poslužitelja.',
      'Pročitali smo i uvjete izvora u drugim zemljama. Većina je sadržavala istu zabranu pa smo i njih zaustavili.',
      'Ostao je samo jedan izričito dopušten izvor. Umjesto da nastavimo sa samo jednom zemljom, odlučili smo pitati nadležno tijelo i pričekati.',
    ],
    verinBaslik: 'Vaši podaci',
    verin: [
      'Ako ste instalirali aplikaciju, vaši popisi ostaju na uređaju.',
      'Ako ste kupili plaćenu pretplatu, nova naplata neće uslijediti. Budući da je aplikacija povučena, povrat možete zatražiti putem App Storea; javite se na destek@cheep.live i pomoći ćemo.',
      'Želite li brisanje računa, možete ga zatražiti na stranici ispod — zahtjeve primamo i dok je poslužitelj ugašen.',
    ],
    neBekliyorBaslik: 'Što čekamo',
    neBekliyor:
      'Podnijeli smo zahtjev ministarstvu prema zakonu o pravu na pristup informacijama, koji obvezuje na odgovor u roku od 15 radnih dana. Odgovor će odrediti pod kojim uvjetima potrošačka aplikacija smije prikazivati te podatke. Ishod ćemo objaviti ovdje.',
    iletisim: 'Pitanja ili zahtjevi:',
    yasal: 'Pravno',
    gizlilik: 'Pravila privatnosti',
    kosullar: 'Uvjeti korištenja',
    hesapSil: 'Brisanje računa',
    dil: 'Jezik',
  },
  hu: {
    rozet: 'Szünetel',
    baslik: 'A Cheep jelenleg nem működik',
    giris:
      'Az alkalmazást visszavontuk a Google Play és az App Store áruházból, a szervereinket pedig leállítottuk. Ez átmeneti, és az ok nem műszaki: hivatalosan megkérdeztük, milyen feltételekkel használhatjuk az áradatokat, és a választ várjuk.',
    neOlduBaslik: 'Mi történt',
    neOldu: [
      'A török árakhoz használt forrás feltételei írásos engedélyt kívánnak meg. A kérelmünket elutasították, és közölték, hogy az illetékes hatóság a minisztériumok.',
      'Ezután minden onnan származó áradatot eltávolítottunk az alkalmazásból és a szervereinkről.',
      'A többi ország forrásainak feltételeit is elolvastuk. A legtöbbben ugyanaz a tiltás szerepelt, ezért azokat is leállítottuk.',
      'Egyetlen, egyértelműen engedélyezett forrás maradt. Ahelyett, hogy egyetlen országgal folytatnánk, úgy döntöttünk, megkérdezzük az illetékes hatóságot és megvárjuk a választ.',
    ],
    verinBaslik: 'A te adataid',
    verin: [
      'Ha telepítetted az alkalmazást, a listáid továbbra is az eszközödön vannak.',
      'Ha fizetős előfizetést vásároltál, újabb díjat nem vonunk le. Mivel az alkalmazást visszavontuk, visszatérítést kérhetsz az App Store-on keresztül; írj a destek@cheep.live címre, és segítünk.',
      'Ha szeretnéd törölni a fiókodat, az alábbi oldalon kérheted — a kéréseket leállított szerver mellett is megkapjuk.',
    ],
    neBekliyorBaslik: 'Mire várunk',
    neBekliyor:
      'Közérdekű adatigénylést nyújtottunk be a minisztériumhoz, amely 15 munkanapon belüli választ ír elő. A válasz dönti el, milyen feltételekkel jelenítheti meg egy fogyasztói alkalmazás ezeket az adatokat. Az eredményt itt tesszük közzé.',
    iletisim: 'Kérdés vagy kérés:',
    yasal: 'Jogi',
    gizlilik: 'Adatvédelmi irányelvek',
    kosullar: 'Felhasználási feltételek',
    hesapSil: 'Fiók törlése',
    dil: 'Nyelv',
  },
  ro: {
    rozet: 'În pauză',
    baslik: 'Cheep nu funcționează momentan',
    giris:
      'Aplicația a fost retrasă din Google Play și App Store, iar serverele noastre sunt oprite. Este o situație temporară, iar motivul nu este tehnic: am întrebat oficial în ce condiții putem folosi datele despre prețuri și așteptăm răspunsul.',
    neOlduBaslik: 'Ce s-a întâmplat',
    neOldu: [
      'Sursa folosită pentru prețurile din Turcia cere, prin termenii săi, permisiune scrisă. Cererea ne-a fost respinsă, fiind indicate ministerele drept autoritate competentă.',
      'Am eliminat apoi toate datele de preț provenite din acea sursă, din aplicație și de pe servere.',
      'Am citit și termenii surselor din celelalte țări. Majoritatea conțineau aceeași interdicție, așa că le-am oprit și pe acelea.',
      'A rămas o singură sursă permisă explicit. În loc să continuăm cu o singură țară, am ales să întrebăm autoritatea competentă și să așteptăm.',
    ],
    verinBaslik: 'Datele tale',
    verin: [
      'Dacă ai instalat aplicația, listele tale rămân pe dispozitiv.',
      'Dacă ai cumpărat un abonament plătit, nu îți va mai fi perceput niciun cost. Întrucât aplicația a fost retrasă, poți cere rambursarea prin App Store; scrie-ne la destek@cheep.live și te ajutăm.',
      'Dacă vrei ștergerea contului, o poți cere pe pagina de mai jos — primim solicitările și cu serverul oprit.',
    ],
    neBekliyorBaslik: 'Ce așteptăm',
    neBekliyor:
      'Am depus o cerere la minister în baza legii privind liberul acces la informații, care obligă la un răspuns în 15 zile lucrătoare. Răspunsul va stabili în ce condiții o aplicație pentru consumatori poate afișa aceste date. Vom publica rezultatul aici.',
    iletisim: 'Întrebări sau solicitări:',
    yasal: 'Informații legale',
    gizlilik: 'Politica de confidențialitate',
    kosullar: 'Termeni de utilizare',
    hesapSil: 'Ștergerea contului',
    dil: 'Limbă',
  },
}

export function PausedHome() {
  const locale = useLocale()
  const t = METIN[locale] ?? METIN.en
  const p = localePrefix(locale)

  return (
    <div className="min-h-screen bg-forest-deep text-cream">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10 sm:px-8 sm:py-16">
        <header className="flex items-center justify-between gap-4">
          <Link to={p || '/'} className="font-display text-xl font-bold tracking-tight">
            Cheep
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-mint/40 bg-mint-soft/10 px-3 py-1 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-clementine" aria-hidden="true" />
            {t.rozet}
          </span>
        </header>

        <main className="flex-1 pt-14 sm:pt-20">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            {t.baslik}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-cream/80 sm:text-lg">
            {t.giris}
          </p>

          <Bolum baslik={t.neOlduBaslik}>
            <ol className="space-y-4">
              {t.neOldu.map((m, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-xs text-mint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm leading-relaxed text-cream/75">{m}</span>
                </li>
              ))}
            </ol>
          </Bolum>

          <Bolum baslik={t.neBekliyorBaslik}>
            <p className="text-sm leading-relaxed text-cream/75">{t.neBekliyor}</p>
          </Bolum>

          <Bolum baslik={t.verinBaslik}>
            <ul className="space-y-3">
              {t.verin.map((m, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-cream/75">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mint" aria-hidden="true" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </Bolum>

          <p className="mt-12 text-sm text-cream/75">
            {t.iletisim}{' '}
            <a className="font-semibold text-mint underline underline-offset-4" href="mailto:destek@cheep.live">
              destek@cheep.live
            </a>
          </p>
        </main>

        <footer className="mt-16 border-t border-cream/10 pt-8 text-sm">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-cream/70">
            <Link className="underline underline-offset-4 hover:text-cream" to={`${p}/privacy`}>
              {t.gizlilik}
            </Link>
            <Link className="underline underline-offset-4 hover:text-cream" to={`${p}/terms`}>
              {t.kosullar}
            </Link>
            <Link className="underline underline-offset-4 hover:text-cream" to={`${p}/delete`}>
              {t.hesapSil}
            </Link>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-cream/50">
            <span>{t.dil}:</span>
            {LOCALES.map((l) => (
              <Link
                key={l}
                to={localePrefix(l) || '/'}
                className={l === locale ? 'font-semibold text-cream' : 'hover:text-cream/80'}
              >
                {LOCALE_NATIVE_NAMES[l]}
              </Link>
            ))}
          </div>

          <p className="mt-6 font-mono text-xs text-cream/40">© {new Date().getFullYear()} Cheep</p>
        </footer>
      </div>
    </div>
  )
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 sm:mt-14">
      <h2 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-mint">
        {baslik}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}
