import type { Dict } from './types'

export const hr: Dict = {
  htmlLang: 'hr',
  ogLocale: 'hr_HR',

  notFound: {

    title: 'Stranica nije pronađena — Cheep',

    description: 'Nismo pronašli tu stranicu.',

  },


  nav: {
    links: [
      { label: 'Proizvodi', href: '/proizvodi' },
      { label: 'Kako radi', href: '#how' },
      { label: 'Ušteda', href: '#savings' },
      { label: 'Države', href: '#coverage' },
      { label: 'Značajke', href: '#features' },
      { label: 'Česta pitanja', href: '#faq' },
    ],
    download: 'Preuzmi',
    openMenu: 'Otvori izbornik',
    closeMenu: 'Zatvori izbornik',
    home: 'Cheep — početna stranica',
    langMenuLabel: 'Odaberi jezik',
  },

  hero: {
    badge: 'Uživo u Turskoj i Poljskoj · 5 država',
    titleLine1: 'Isti proizvod.',
    titleLine2: 'Najniža cijena.',
    sub: 'Cheep uspoređuje cijene trgovačkih lanaca jednu po jednu i tvoj popis za kupnju prebacuje u najpovoljniju košaricu. Stvarne cijene, osvježene svaki dan — štediš bez razmišljanja.',
    ctaPrimary: 'Preuzmi aplikaciju',
    ctaSecondary: 'Kako radi?',
    // Cijene su primjer. Poredane su tako da je posljednja najjeftinija.
    ticker: [
      { product: 'Mlijeko 1 L', prices: ['Konzum 1,29 €', 'Spar 1,15 €', 'Lidl 1,09 €'] },
      { product: 'Jaja 10 kom.', prices: ['Konzum 3,19 €', 'Kaufland 2,99 €', 'Plodine 2,79 €'] },
      { product: 'Ulje 1 L', prices: ['Tommy 2,59 €', 'Spar 2,39 €', 'Lidl 2,19 €'] },
      { product: 'Kruh', prices: ['Konzum 1,59 €', 'Plodine 1,39 €', 'Lidl 1,29 €'] },
      { product: 'Kava 250 g', prices: ['Spar 3,99 €', 'Konzum 3,69 €', 'Kaufland 3,49 €'] },
    ],
    tagCheapest: '✓ najjeftinije',
    tagSaving: '18 % jeftinije',
  },

  compare: {
    eyebrow: 'Javni podaci · osvježeno svaki dan',
    titleLead: 'Isti proizvod,',
    titleAccent: 'druga cijena u svakoj trgovini.',
    body: 'Za jednu litru mlijeka možeš platiti 10–15 % više, ovisno o trgovini. Cheep stavlja cijene istog proizvoda iz svih lanaca jednu uz drugu i u sekundi ti pokaže najjeftiniju — bez nagađanja i bez obilaženja trgovina.',
    sourceNote: 'Cijene iz javno dostupnih izvora trgovačkih lanaca · osvježeno svaki dan',
    card: {
      name: 'Trajno mlijeko 3,2 % m.m.',
      unit: '1 L · ista marka, isti proizvod',
      emoji: '🥛',
      rows: [
        { store: 'Konzum', price: '1,29 €', color: '#E1251B' },
        { store: 'Plodine', price: '1,25 €', color: '#F39200' },
        { store: 'Spar', price: '1,15 €', color: '#006B3F' },
        { store: 'Lidl', price: '1,09 €', cheapest: true, color: '#0050AA' },
      ],
      cheapestBadge: 'Najjeftinije',
      savingLabel: 'Tvoja ušteda na ovom proizvodu',
      savingValue: '0,20 € · 16 %',
    },
  },

  how: {
    eyebrow: 'Kako radi',
    title: 'Ušteda u tri koraka',
    sub: 'Ništa komplicirano. Ti daš popis, o ostalom se brine Cheep.',
    steps: [
      {
        n: '01',
        title: 'Izradi popis',
        body: 'Upiši što kupuješ ili pretraži proizvode. Mlijeko, jaja, deterdžent… sve ide na popis.',
      },
      {
        n: '02',
        title: 'Cheep uspoređuje',
        body: 'Svaki proizvod uparuje po barkodu i pretražuje aktualne cijene u svim lancima. U nekoliko sekundi.',
      },
      {
        n: '03',
        title: 'Idi tamo gdje je jeftinije',
        body: 'Prebaci košaricu u najpovoljniju trgovinu i vidi najbližu poslovnicu. Odmah znaš koliko si uštedio.',
      },
    ],
  },

  savings: {
    eyebrow: 'Koliko to donosi?',
    titleLead: 'U prosječnoj košarici plati',
    titleAccentSuffix: ' manje',
    sub: 'Prosječna razlika koju korisnici ostvare kad popis prebace u najpovoljniju trgovinu. Djeluje sitno, ali na razini mjeseca i godine naraste u ozbiljan iznos.',
    stats: [
      { key: 'products', label: 'uparenih proizvoda' },
      { key: 'branches', label: 'poslovnica u bazi' },
      { key: 'countries', label: 'države, jedna aplikacija' },
      { key: 'updates', label: 'osvježavanje cijena' },
    ],
    updatesValue: 'Svaki dan',
  },

  coverage: {
    eyebrow: 'Pokrivenost',
    titleLead: 'Uživo u Turskoj i Poljskoj,',
    titleAccent: 'Europa stiže',
    sub: 'Isti motor radi u pet država. Cijene uparujemo po barkodu i svaki dan osvježavamo stvarnim podacima iz trgovina.',
    countries: [
      { code: 'TR', name: 'Turska' },
      { code: 'PL', name: 'Poljska' },
      { code: 'DE', name: 'Njemačka' },
      { code: 'CH', name: 'Švicarska' },
      { code: 'SE', name: 'Švedska' },
    ],
    branchesUnit: 'poslovnica',
    live: 'Uživo',
    soon: 'Uskoro',
  },

  features: {
    eyebrow: 'Značajke',
    title: 'Ne samo cijena — nego i pamet',
    sub: 'Detalji zbog kojih je Cheep stvarno koristan.',
    items: [
      {
        emoji: '🔖',
        title: 'Cijene uparene po barkodu',
        body: 'Ne „mlijeko”, nego to mlijeko. Proizvode uparujemo po EAN barkodu, pa uspoređuješ točno isti proizvod u različitim trgovinama. Bez zavaravajućih podudaranja.',
      },
      {
        emoji: '📍',
        title: 'Najbliža poslovnica',
        body: 'Prikazuje najbližu i najjeftiniju poslovnicu prema stvarnoj udaljenosti od tvoje lokacije.',
      },
      {
        emoji: '🤖',
        title: 'Cheep asistent',
        body: 'Pitaj „gdje je ovaj tjedan najjeftiniji doručak?” i umjetna inteligencija složit će ti popis.',
      },
      {
        emoji: '📈',
        title: 'Povijest cijena',
        body: 'Je li proizvod stvarno pojeftinio? Pogledaj prijašnju cijenu i ne nasjedaj na lažnu akciju.',
      },
      {
        emoji: '🧺',
        title: 'Pametni popisi',
        body: 'Složi košaricu i na jednom zaslonu vidi koliko ispada u svakoj trgovini.',
      },
    ],
  },

  faq: {
    eyebrow: 'Česta pitanja',
    title: 'Dobro je znati',
    sub: 'Od toga odakle Cheep uzima cijene do toga koliko aplikacija košta.',
    items: [
      {
        q: 'Što je Cheep i čemu služi?',
        a: 'Cheep je besplatna aplikacija za kupnju koja uspoređuje cijene u trgovinama. Ti izradiš popis za kupnju, a Cheep svaki proizvod usporedi među lancima, pokaže koliko popis ukupno stoji u svakoj trgovini i ponudi ti najjeftiniju košaricu.',
      },
      {
        q: 'Odakle dolaze cijene i koliko se često osvježavaju?',
        a: 'U Turskoj cijene preuzimamo iz službenog, javno dostupnog izvora turskog Ministarstva trgovine (marketfiyati.org.tr), a u Poljskoj iz javno dostupnih izvora trgovačkih lanaca. Cijene osvježavamo svaki dan. Informativne su naravi i mogu se razlikovati od cijene na blagajni.',
      },
      {
        q: 'Cijene kojih trgovina uspoređujete?',
        a: 'U Turskoj: Migros, A101, BİM, ŞOK, CarrefourSA i Tarım Kredi. U Poljskoj: Biedronka, Lidl, Żabka, Auchan i Carrefour. Ukupno pokrivamo više od 23.500 poslovnica.',
      },
      {
        q: 'Je li aplikacija besplatna?',
        a: 'Jest. Preuzimanje i korištenje Cheepa je besplatno: usporedba cijena, popisi, najjeftinija ruta i obavijesti o padu cijena zauvijek ostaju besplatni. Neobavezna pretplata Cheep Premium povećava samo dnevnu kvotu poruka AI asistenta; uvjeti su u Uvjetima korištenja.',
      },
      {
        q: 'Kako znate da je riječ o istom proizvodu?',
        a: 'Proizvode uparujemo po EAN barkodu, a ne po nazivu. Znači, ne uspoređuje se „mlijeko” s „mlijekom”, nego točno ista marka, ista gramaža i isti proizvod. Bez zavaravajućih podudaranja.',
      },
      {
        q: 'U kojim državama mogu koristiti aplikaciju? Postoji li verzija za iPhone?',
        a: 'Cheep je trenutačno uživo u Turskoj i Poljskoj; Njemačka, Švicarska i Švedska su na putu. Aplikacija se za Android preuzima s Google Playa, a verzija za iOS je u pripremi.',
      },
    ],
  },

  download: {
    titleLead: 'Neka ti sljedeća košarica bude',
    titleAccent: 'jeftinija',
    sub: 'Preuzmi Cheep, izradi popis, vidi uštedu. Besplatno u Turskoj i Poljskoj.',
    playAlt: 'Preuzmi s Google Playa',
    storeTop: 'Uskoro',
    storeBottom: 'App Store',
    note: 'Besplatno preuzimanje · bez reklama · neobavezni Premium · Android 8.0 ili noviji',
  },

  footer: {
    tagline: 'Isti proizvod, najniža cijena. Usporedi cijene trgovina i uštedi na svakoj kupnji.',
    cols: [
      {
        title: 'Proizvod',
        links: [
          { label: 'Kako radi', href: '#how' },
          { label: 'Značajke', href: '#features' },
          { label: 'Države', href: '#coverage' },
          { label: 'Česta pitanja', href: '#faq' },
          { label: 'Preuzmi', href: '#download' },
        ],
      },
      {
        title: 'Cijene',
        links: [
          { label: 'Izvještaj o cijenama', href: '/izvjestaj-cijena' },
          { label: 'Najjeftinije trgovine', href: '/najjeftinije-trgovine' },
        ],
      },
      {
        title: 'Pravne informacije',
        links: [
          { label: 'Politika privatnosti', href: '/privacy' },
          { label: 'Brisanje računa', href: '/delete' },
          { label: 'Uvjeti korištenja', href: '/terms' },
        ],
      },
      {
        title: 'Kontakt',
        links: [
          { label: 'destek@cheep.live', href: 'mailto:destek@cheep.live' },
          { label: 'gizlilik@cheep.live', href: 'mailto:gizlilik@cheep.live' },
        ],
      },
    ],
    disclaimer:
      'Svi nazivi marki i logotipi registrirani su žigovi svojih vlasnika. Cheep nije službeni partner tih trgovačkih lanaca niti s njima surađuje; nazivi marki koriste se isključivo kako bi se naznačilo čija je cijena prikazana. U Turskoj cijene preuzimamo iz službenog, javno dostupnog izvora turskog Ministarstva trgovine (marketfiyati.org.tr), a u Poljskoj iz javno dostupnih izvora trgovačkih lanaca; informativne su naravi i mogu se razlikovati od cijene na blagajni.',
    copyright: '© 2026 Cheep. Sva prava pridržana.',
    madeIn: 'Stvoreno s ljubavlju za Tursku i Poljsku',
  },

  legal: {
    eyebrow: 'Cheep · Pravne informacije',
    updatedPrefix: 'Posljednje ažuriranje:',
    backHome: '← Početna stranica',

    privacy: {
      title: 'Politika privatnosti',
      updated: '2. srpnja 2026.',
      blocks: [
        { p: 'U Cheepu („mi”, „aplikacija”) poštujemo tvoju privatnost. Ova politika objašnjava koje podatke prikupljamo kad koristiš mobilnu aplikaciju Cheep i stranicu **cheep.live**, zašto ih prikupljamo i koja su tvoja prava. Cheep je aplikacija za uštedu koja uspoređuje cijene u trgovinama; tvoje podatke **ne prodajemo**.' },
        { h2: 'Podaci koje prikupljamo' },
        { h3: 'Jer nam ih daš' },
        { ul: [
          '**Podaci računa:** tvoja e-mail adresa, ime i lozinka (lozinka se nikad ne pohranjuje u čitljivom obliku — nepovratno je šifrirana algoritmom bcrypt).',
          '**Preferencije:** odabrana država i jezik.',
          '**Sadržaj u aplikaciji:** popisi za kupnju koje izradiš, tvoje omiljene trgovine, povratne informacije o cijenama koje pošalješ i poruke koje napišeš Cheep asistentu.',
        ] },
        { h3: 'Kad daš privolu' },
        { ul: [
          '**Lokacija:** koristi se isključivo uz tvoju privolu i samo kako bi ti prikazala najbliže poslovnice trgovina i stvarne udaljenosti. Koordinate tvog uređaja u tu se svrhu prosljeđuju našem poslužitelju. Lokaciju ne pratimo neprekidno niti je prikupljamo u pozadini.',
          '**Identifikator obavijesti:** ako dopustiš obavijesti, jedinstveni identifikator tvog uređaja (push token) pohranjuje se i povezuje s tvojim računom. Služi isključivo za slanje obavijesti; briše se kad isključiš obavijesti ili se odjaviš.',
        ] },
        { h3: 'Automatski' },
        { ul: [
          '**Osnovni tehnički podaci:** standardni zapisi nužni za rad aplikacije i uklanjanje grešaka (npr. vrsta uređaja, izvještaji o greškama).',
        ] },
        { h2: 'Zašto koristimo podatke' },
        { ul: [
          'Uparivanje proizvoda po barkodu i usporedba cijena u trgovinama.',
          'Prikaz najbliže i najpovoljnije poslovnice.',
          'Otvaranje računa, prijava i potvrda e-mail adrese.',
          'Odgovaranje na tvoja pitanja putem Cheep asistenta.',
          'Razvoj aplikacije i briga o njezinoj sigurnosti.',
        ] },
        { h2: 'Dijeljenje s trećim stranama' },
        { p: 'Tvoje podatke ne prodajemo u marketinške svrhe. Dijelimo ih u ograničenom opsegu, samo ondje gdje je to nužno za rad usluge:' },
        { ul: [
          '**Cheep asistent (umjetna inteligencija):** poruke koje napišeš asistentu prosljeđuju se Googleovoj usluzi Gemini radi generiranja odgovora.',
          '**E-pošta:** poruke za potvrdu i obavijesti šaljemo preko infrastrukture Resend.',
          '**Preusmjeravanja na trgovine:** kad dodirneš poveznicu na trgovinu, bit ćeš preusmjeren na njezinu stranicu; pritom se tvoji osobni podaci ne dijele.',
          '**Zakonska obveza:** podaci se mogu podijeliti s nadležnim tijelima kad to zakon zahtijeva.',
        ] },
        { h2: 'Sigurnost podataka' },
        { p: 'Sav promet između aplikacije i naših poslužitelja šifriran je protokolom HTTPS (TLS). Lozinke se hashiraju algoritmom bcrypt. Ipak podsjećamo da nijedan prijenos putem interneta nije 100 % siguran.' },
        { h2: 'Čuvanje i brisanje podataka' },
        { p: 'Tvoje podatke čuvamo dokle god je tvoj račun aktivan. U svakom trenutku možeš trajno izbrisati račun i sve povezane podatke:' },
        { ul: [
          'u aplikaciji: **Profil → Izbriši moj račun**, ili',
          'putem obrasca na stranici [cheep.live/hr/delete](/delete).',
        ] },
        { p: 'Brisanje se ne može poništiti — trajno nestaju svi tvoji podaci, uključujući popise, omiljene trgovine, povratne informacije i razgovore s asistentom.' },
        { h2: 'Tvoja prava (GDPR)' },
        { p: 'Imaš pravo na pristup svojim podacima, njihov ispravak ili brisanje te na prigovor na obradu. Za ostvarivanje tih prava piši na [gizlilik@cheep.live](mailto:gizlilik@cheep.live).' },
        { h2: 'Djeca' },
        { p: 'Cheep nije namijenjen djeci mlađoj od 13 godina i svjesno ne prikuplja njihove podatke.' },
        { h2: 'Izmjene' },
        { p: 'Ovu politiku možemo povremeno ažurirati. O važnim izmjenama obavijestit ćemo te u aplikaciji ili e-poštom. Aktualna se verzija uvijek nalazi na ovoj stranici.' },
        { h2: 'Kontakt' },
        { p: 'Pitanja: [gizlilik@cheep.live](mailto:gizlilik@cheep.live)' },
      ],
    },

    terms: {
      title: 'Uvjeti korištenja',
      updated: '25. kolovoza 2026.',
      blocks: [
        { p: 'Korištenjem Cheepa prihvaćaš ove uvjete. Cheep je informativni alat za usporedbu cijena u trgovinama.' },
        { h2: 'Narav usluge' },
        { ul: [
          'Cijene se redovito prikupljaju iz javno dostupnih izvora trgovačkih lanaca i osvježavaju svaki dan.',
          'Cijene su informativne naravi i mogu se razlikovati od cijene koja vrijedi u trgovini. Obvezujuća je cijena na blagajni.',
          'Cheep nije prodajno mjesto — ne prodaje proizvode niti naplaćuje.',
        ] },
        { h2: 'Tvoj račun' },
        { ul: [
          'Pri registraciji unesi točne podatke; za sigurnost svog računa odgovaraš ti.',
          'Račun možeš [izbrisati](/delete) u bilo kojem trenutku.',
        ] },
        { h2: 'Žigovi i intelektualno vlasništvo' },
        { ul: [
          'Svi nazivi i logotipi trgovina i proizvoda registrirani su žigovi svojih vlasnika. Ti se nazivi koriste isključivo kako bi se **naznačilo čija je cijena prikazana** (dopuštena informativna uporaba).',
          'Cheep **nije službeni partner navedenih lanaca, nije s njima povezan niti ga oni podržavaju**.',
          'Podaci o cijenama prikupljaju se iz javno dostupnih izvora. Vlasnik marke koji želi uputiti primjedbu na sadržaj može pisati na [destek@cheep.live](mailto:destek@cheep.live) — na opravdane zahtjeve reagiramo bez odgode.',
        ] },
        { h2: 'Pretplata Cheep Premium' },
        { p: 'Usporedba cijena, popisi za kupnju, najjeftinija ruta i obavijesti o padu cijena jesu i ostat će besplatni. Cheep Premium neobavezna je pretplata koja povećava isključivo kvotu poruka AI asistenta.' },
        { ul: [
          '**Opseg:** U besplatnoj verziji asistentu se može poslati 5 poruka dnevno. Premium donosi 300 poruka mjesečno (uz sigurnosno ograničenje od 50 poruka dnevno). Sve su ostale značajke u oba slučaja identične.',
          '**Razdoblje i cijena:** Pretplata se nudi u mjesečnoj ili godišnjoj varijanti. Važeća cijena, valuta i trajanje razdoblja jasno su prikazani na zaslonu za kupnju u aplikaciji prije same kupnje i mogu se razlikovati ovisno o državi.',
          '**Automatsko obnavljanje:** Pretplata se obnavlja automatski, osim ako se otkaže najmanje 24 sata prije isteka tekućeg razdoblja. Naknada se naplaćuje s računa u trgovini aplikacijama unutar 24 sata prije obnove.',
          '**Otkazivanje:** Pretplatu možeš otkazati u bilo kojem trenutku u postavkama pretplata svog računa u trgovini aplikacijama (App Store: Postavke → Apple ID → Pretplate; Google Play: Trgovina Play → Pretplate). Otkazivanje počinje vrijediti od kraja plaćenog razdoblja — do tada zadržavaš pristup Premiumu.',
          '**Plaćanje i povrat:** Plaćanje naplaćuje trgovina iz koje si preuzeo aplikaciju (Apple App Store ili Google Play); Cheep ne vidi niti pohranjuje podatke o kartici. Povrati podliježu politici povrata dotične trgovine i prijavljuju se izravno njoj.',
          '**Probno razdoblje:** Ako se nudi besplatno probno razdoblje, izostanak otkazivanja prije njegova isteka znači prelazak na plaćenu pretplatu. Neiskorišteni dio probnog razdoblja prestaje vrijediti u trenutku kupnje pretplate.',
        ] },
        { h2: 'Ograničenje odgovornosti' },
        { p: 'Cheep ne jamči potpunost ni aktualnost podataka o cijenama i ne odgovara za posljedice odluka donesenih na temelju tih podataka.' },
        { h2: 'Izmjene' },
        { p: 'Ove uvjete možemo ažurirati; aktualna se verzija uvijek objavljuje na ovoj stranici.' },
        { h2: 'Kontakt' },
        { p: '[destek@cheep.live](mailto:destek@cheep.live)' },
      ],
    },

    del: {
      title: 'Brisanje računa',
      updated: '2. srpnja 2026.',
      intro: [
        { p: 'Možeš trajno izbrisati svoj Cheep račun i **sve svoje podatke** (popise za kupnju, omiljene trgovine, povratne informacije o cijenama, razgovore s asistentom i profil). Ova se radnja **ne može poništiti**.' },
        { h2: 'Iz aplikacije' },
        { p: 'Najbrži put: u aplikaciji Cheep odaberi **Profil → Izbriši moj račun**.' },
        { h2: 'Nemaš aplikaciju? Izbriši putem weba' },
        { p: 'Ako si aplikaciju deinstalirao, potvrdi identitet e-mail adresom i lozinkom svog računa pa izbriši račun. Podaci služe isključivo za provjeru identiteta.' },
      ],
      emailLabel: 'E-mail',
      emailPlaceholder: 'primjer@email.com',
      passwordLabel: 'Lozinka',
      confirmLabel: 'Razumijem da će moj račun i svi moji podaci biti trajno izbrisani te da se ova radnja ne može poništiti.',
      submit: 'Trajno izbriši moj račun',
      submitting: 'Brisanje…',
      deletedTitle: '✓ Izbrisano',
      successFallback: 'Tvoj račun i svi tvoji podaci trajno su izbrisani.',
      errorFallback: 'Brisanje nije uspjelo. Provjeri e-mail adresu i lozinku.',
      networkError: 'Povezivanje s poslužiteljem nije uspjelo. Pokušaj ponovno kasnije.',
      help: [
        { h2: 'Pomoć' },
        { p: 'Ako naiđeš na problem, piši na [destek@cheep.live](mailto:destek@cheep.live) — izbrisat ćemo račun umjesto tebe.' },
      ],
    },
  },

  seo: {
    home: {
      title: 'Cheep — Usporedba cijena u trgovinama',
      description:
        'Usporedi cijenu istog proizvoda među trgovačkim lancima. Prebaci popis za kupnju u najjeftiniju trgovinu i uštedi na svakoj košarici. Preuzmi besplatno.',
    },
    privacy: {
      title: 'Politika privatnosti — Cheep',
      description:
        'Koje podatke Cheep prikuplja, zašto ih prikuplja i koja su tvoja prava? Naša politika privatnosti usklađena s GDPR-om.',
    },
    terms: {
      title: 'Uvjeti korištenja — Cheep',
      description:
        'Uvjeti korištenja Cheepa: narav usluge, izvori podataka o cijenama, žigovi i ograničenje odgovornosti.',
    },
    del: {
      title: 'Brisanje računa — Cheep',
      description:
        'Trajno izbriši svoj Cheep račun i sve svoje podatke — iz aplikacije ili putem obrasca na ovoj stranici.',
    },
    appDescription:
      'Cheep je besplatna aplikacija za kupnju koja uspoređuje cijene u trgovinama po barkodu. Prebacuje tvoj popis za kupnju u najjeftiniju trgovinu i pokazuje najbližu poslovnicu.',
  },
}
