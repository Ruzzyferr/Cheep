import type { Dict } from './types'

export const hu: Dict = {
  htmlLang: 'hu',
  ogLocale: 'hu_HU',

  notFound: {

    title: 'Az oldal nem található — Cheep',

    description: 'Nem találtuk meg ezt az oldalt.',

  },


  nav: {
    links: [
      { label: 'Termékek', href: '/termekek' },
      { label: 'Hogyan működik', href: '#how' },
      { label: 'Megtakarítás', href: '#savings' },
      { label: 'Országok', href: '#coverage' },
      { label: 'Funkciók', href: '#features' },
      { label: 'GYIK', href: '#faq' },
    ],
    download: 'Letöltés',
    openMenu: 'Menü megnyitása',
    closeMenu: 'Menü bezárása',
    home: 'Cheep — főoldal',
    langMenuLabel: 'Válassz nyelvet',
  },

  hero: {
    badge: 'Élesben 5 országban · 120 000+ termék',
    titleLine1: 'Ugyanaz a termék.',
    titleLine2: 'A legolcsóbb ár.',
    sub: 'A Cheep sorra összeveti a boltok árait, és a bevásárlólistádat a legolcsóbb kosárba teszi át. Valódi, naponta frissülő árak — gondolkodás nélkül spórolsz.',
    ctaPrimary: 'Töltsd le az appot',
    ctaSecondary: 'Hogyan működik?',
    // Az árak példaértékűek. Az első a legdrágább, az utolsó a legolcsóbb.
    ticker: [
      { product: 'Tej 1 l', prices: ['Tesco 429 Ft', 'Auchan 399 Ft', 'Lidl 379 Ft'] },
      { product: 'Tojás 10 db', prices: ['Auchan 1 249 Ft', 'Penny 1 149 Ft', 'Aldi 1 099 Ft'] },
      { product: 'Napraforgó étolaj 1 l', prices: ['Tesco 1 249 Ft', 'Penny 1 149 Ft', 'Lidl 1 099 Ft'] },
      { product: 'Kenyér 1 kg', prices: ['Tesco 699 Ft', 'Auchan 649 Ft', 'Aldi 599 Ft'] },
      { product: 'Trappista sajt 1 kg', prices: ['Auchan 2 899 Ft', 'Tesco 2 699 Ft', 'Lidl 2 499 Ft'] },
    ],
    tagCheapest: '✓ legolcsóbb',
    tagSaving: '18% megtakarítás',
  },

  compare: {
    eyebrow: 'Nyilvános adatok · naponta frissül',
    titleLead: 'Ugyanaz a termék,',
    titleAccent: 'minden boltban más ár.',
    body: 'Egyetlen doboz tejért boltról boltra 10–15%-kal is többet fizethetsz. A Cheep egymás mellé teszi ugyanannak a terméknek az árát a láncoknál, és másodpercek alatt megmutatja a legolcsóbbat — találgatás és felesleges kör nélkül.',
    sourceNote: 'A GVH hivatalos Árfigyelő rendszeréből · naponta frissül',
    card: {
      name: 'Tartós tej 2,8%',
      unit: '1 l · ugyanaz a márka, ugyanaz a termék',
      emoji: '🥛',
      rows: [
        { store: 'Tesco', price: '429 Ft', color: '#00539F' },
        { store: 'Auchan', price: '399 Ft', color: '#E2001A' },
        { store: 'Penny', price: '389 Ft', color: '#D91F26' },
        { store: 'Lidl', price: '379 Ft', cheapest: true, color: '#0050AA' },
      ],
      cheapestBadge: 'Legolcsóbb',
      savingLabel: 'Ezen a terméken megtakarítasz',
      savingValue: '50 Ft · 12%',
    },
  },

  how: {
    eyebrow: 'Hogyan működik',
    title: 'Három lépésben spórolsz',
    sub: 'Semmi bonyolult. Te adod a listát, a többit a Cheep intézi.',
    steps: [
      {
        n: '01',
        title: 'Állítsd össze a listád',
        body: 'Írd fel, mit veszel, vagy keresd ki a termékeket. Tej, tojás, mosószer… minden felkerül a listára.',
      },
      {
        n: '02',
        title: 'A Cheep összehasonlít',
        body: 'Vonalkód alapján párosítja a termékeket, és végigfésüli az összes lánc aktuális árait. Néhány másodperc alatt.',
      },
      {
        n: '03',
        title: 'Menj oda, ahol olcsóbb',
        body: 'Vidd át a kosarad a legkedvezőbb boltba, és nézd meg a legközelebbi üzletet. Azonnal látod, mennyit nyertél.',
      },
    ],
  },

  savings: {
    eyebrow: 'Mennyit ér ez?',
    titleLead: 'Egy átlagos kosárban',
    titleAccentSuffix: '-kal kevesebbet fizetsz',
    sub: 'Ennyi az az átlagos különbség, amit a felhasználók megtakarítanak, amikor a listájukat a legolcsóbb boltba viszik át. Apróságnak tűnik, de egy hónap, egy év alatt komoly összeg lesz belőle.',
    stats: [
      { key: 'products', label: 'párosított termék' },
      { key: 'branches', label: 'üzlet az adatbázisban' },
      { key: 'countries', label: 'ország, egyetlen alkalmazás' },
      { key: 'updates', label: 'árfrissítés' },
    ],
    updatesValue: 'Naponta',
  },

  coverage: {
    eyebrow: 'Lefedettség',
    titleLead: 'Élesben öt országban,',
    titleAccent: 'Európa következik',
    sub: 'Törökország, Lengyelország, Horvátország, Magyarország és Románia. Az árak vonalkód alapján párosulnak, és minden nap valós bolti adatokból frissülnek.',
    countries: [
      { code: 'TR', name: 'Törökország' },
      { code: 'PL', name: 'Lengyelország' },
      { code: 'HR', name: 'Horvátország' },
      { code: 'HU', name: 'Magyarország' },
      { code: 'RO', name: 'Románia' },
    ],
    branchesUnit: 'üzlet',
    live: 'Élesben',
    soon: 'Hamarosan',
  },

  features: {
    eyebrow: 'Funkciók',
    title: 'Nemcsak ár — józan ész is',
    sub: 'Azok a részletek, amelyektől a Cheep igazán hasznos lesz.',
    items: [
      {
        emoji: '🔖',
        title: 'Vonalkód alapján párosított árak',
        body: 'Nem „tej”, hanem pontosan az a tej. A termékeket EAN-vonalkód alapján párosítjuk, így a különböző boltokban tényleg ugyanazt a terméket veted össze. Félrevezető találatok nélkül.',
      },
      {
        emoji: '📍',
        title: 'A legközelebbi üzlet',
        body: 'A helyzetedtől mért valódi távolság alapján mutatja a legközelebbi és legolcsóbb üzletet.',
      },
      {
        emoji: '🤖',
        title: 'Cheep Asszisztens',
        body: 'Kérdezd meg: „hol a legolcsóbb a reggeli a héten?”, és a mesterséges intelligencia összeállítja a listád.',
      },
      {
        emoji: '📈',
        title: 'Árelőzmények',
        body: 'Tényleg olcsóbb lett a termék? Nézd meg a korábbi árát, és ne dőlj be az akciónak.',
      },
      {
        emoji: '🧺',
        title: 'Okos listák',
        body: 'Állítsd össze a kosarad, és egyetlen képernyőn látod, melyik boltban mennyibe kerül.',
      },
    ],
  },

  faq: {
    eyebrow: 'Gyakori kérdések',
    title: 'Jó tudni',
    sub: 'Attól kezdve, honnan veszi a Cheep az árakat, addig, hogy mennyibe kerül az alkalmazás.',
    items: [
      {
        q: 'Mi az a Cheep, és mire jó?',
        a: 'A Cheep egy ingyenes bevásárlóalkalmazás, amely a boltok árait hasonlítja össze. Összeállítod a bevásárlólistád, a Cheep pedig minden terméket összevet a láncok között, megmutatja, melyik boltban mennyibe kerül a teljes lista, és eléd teszi a legolcsóbb kosarat.',
      },
      {
        q: 'Honnan származnak az árak, és milyen gyakran frissülnek?',
        a: 'Magyarországon a Gazdasági Versenyhivatal (GVH) hivatalos Árfigyelő rendszeréből, Romániában az állami Monitorul Prețurilor rendszerből, Törökországban a Kereskedelmi Minisztérium nyilvános, hivatalos forrásából (marketfiyati.org.tr), Lengyelországban és Horvátországban pedig az áruházláncok nyilvánosan közzétett árlistáiból gyűjtjük az árakat. Az árakat naponta frissítjük. Tájékoztató jellegűek, és eltérhetnek a pénztárnál fizetendő ártól.',
      },
      {
        q: 'Melyik boltok árait hasonlítjátok össze?',
        a: 'Magyarországon a Tesco, a Lidl, az Aldi, az Auchan és a Penny; Törökországban a Migros, az A101, a BİM, a ŞOK, a CarrefourSA és a Tarım Kredi; Lengyelországban a Biedronka, a Lidl, a Żabka, az Auchan és a Carrefour; Horvátországban a Konzum, a Lidl, a Spar, a Plodine, a Kaufland és a Tommy; Romániában a Kaufland, a Lidl, a Carrefour, az Auchan, a Mega Image és a Penny árait. Összesen több mint 27 500 üzletet fedünk le.',
      },
      {
        q: 'Ingyenes az alkalmazás?',
        a: 'Igen. A Cheep letöltése és használata ingyenes: az összehasonlítás, a listák, a legolcsóbb útvonal és az árcsökkenési értesítések mindig ingyenesek maradnak. Az ingyenes változatban néhány helyen kisebb hirdetések jelennek meg. Az opcionális Cheep Premium előfizetés ezeket teljesen eltávolítja, és megnöveli az MI-asszisztens üzenetkeretét; a részletek a Felhasználási feltételekben olvashatók.',
      },
      {
        q: 'Honnan tudjátok, hogy ugyanarról a termékről van szó?',
        a: 'A termékeket nem név, hanem EAN-vonalkód alapján párosítjuk. Így pontosan ugyanaz a márka, ugyanaz a kiszerelés és ugyanaz a termék kerül összehasonlításra — félrevezető találatok nélkül.',
      },
      {
        q: 'Mely országokban használhatom? Van iPhone-os verzió?',
        a: 'A Cheep jelenleg Magyarországon, Törökországban, Lengyelországban, Horvátországban és Romániában él; Németország, Svájc és Svédország úton van. Az alkalmazás a Google Playről és az App Store-ból is letölthető.',
      },
    ],
  },

  download: {
    titleLead: 'A következő kosarad',
    titleAccent: 'olcsóbb lesz',
    sub: 'Töltsd le a Cheepet, állítsd össze a listád, és nézd meg a megtakarítást. Öt országban ingyenes.',
    playAlt: 'Letöltés a Google Playről',
    appStoreAlt: 'Letöltés az App Store-ból',
    note: 'Ingyenes letöltés · hirdetésmentes az opcionális Premiummal · Android 8.0 és iOS 15.1 vagy újabb',
  },

  footer: {
    tagline: 'Ugyanaz a termék, a legolcsóbb ár. Hasonlítsd össze a boltok árait, és spórolj minden kosáron.',
    cols: [
      {
        title: 'Termék',
        links: [
          { label: 'Hogyan működik', href: '#how' },
          { label: 'Funkciók', href: '#features' },
          { label: 'Országok', href: '#coverage' },
          { label: 'GYIK', href: '#faq' },
          { label: 'Letöltés', href: '#download' },
        ],
      },
      {
        title: 'Árak',
        links: [
          { label: 'Áremelkedési jelentés', href: '/aremelkedesi-jelentes' },
          { label: 'Legolcsóbb bolt', href: '/legolcsobb-bolt' },
        ],
      },
      {
        title: 'Jogi tudnivalók',
        links: [
          { label: 'Adatvédelmi tájékoztató', href: '/privacy' },
          { label: 'Fiók törlése', href: '/delete' },
          { label: 'Felhasználási feltételek', href: '/terms' },
        ],
      },
      {
        title: 'Kapcsolat',
        links: [
          { label: 'destek@cheep.live', href: 'mailto:destek@cheep.live' },
          { label: 'gizlilik@cheep.live', href: 'mailto:gizlilik@cheep.live' },
        ],
      },
    ],
    disclaimer:
      'Minden márkanév és logó a jogosultja bejegyzett védjegye. A Cheep nem áll hivatalos partneri kapcsolatban vagy együttműködésben ezekkel az áruházláncokkal; a márkaneveket kizárólag annak jelölésére használjuk, melyik bolt árát mutatjuk. Magyarországon az árakat a GVH hivatalos Árfigyelő rendszeréből, Romániában a Monitorul Prețurilor rendszerből, Törökországban a Kereskedelmi Minisztérium nyilvános, hivatalos forrásából (marketfiyati.org.tr), Lengyelországban és Horvátországban pedig a boltok nyilvánosan közzétett árlistáiból gyűjtjük; tájékoztató jellegűek, és eltérhetnek a pénztárnál fizetendő ártól.',
    copyright: '© 2026 Cheep. Minden jog fenntartva.',
    madeIn: 'Magyarországnak, Törökországnak, Lengyelországnak, Horvátországnak és Romániának, szeretettel',
  },

  legal: {
    eyebrow: 'Cheep · Jogi tudnivalók',
    updatedPrefix: 'Utolsó frissítés:',
    backHome: '← Főoldal',

    privacy: {
      title: 'Adatvédelmi tájékoztató',
      updated: '2026. július 2.',
      blocks: [
        { p: 'A Cheepnél („mi”, „az alkalmazás”) fontos számunkra a magánszférád. Ez a tájékoztató elmondja, milyen adatokat gyűjtünk, amikor a Cheep mobilalkalmazást és a **cheep.live** oldalt használod, miért gyűjtjük őket, és milyen jogaid vannak. A Cheep egy megtakarítási alkalmazás, amely a boltok árait hasonlítja össze; az adataidat **nem adjuk el**.' },
        { h2: 'Milyen adatokat gyűjtünk' },
        { h3: 'Mert te adod meg' },
        { ul: [
          '**Fiókadatok:** e-mail-címed, neved és jelszavad (a jelszót soha nem tároljuk olvasható formában, bcrypt algoritmussal, visszafejthetetlenül titkosítjuk).',
          '**Beállítások:** a kiválasztott ország és nyelv.',
          '**Alkalmazáson belüli tartalom:** az általad létrehozott bevásárlólisták, a kedvenc boltjaid, az általad küldött ár-visszajelzések és a Cheep Asszisztensnek írt üzeneteid.',
        ] },
        { h3: 'Ha hozzájárulsz' },
        { ul: [
          '**Helyadat:** kizárólag a hozzájárulásoddal és csak azért használjuk, hogy megmutassuk a legközelebbi üzleteket és a valós távolságokat. Ehhez a számításhoz a készüléked koordinátái eljutnak a szerverünkre. A helyzetedet nem követjük folyamatosan, és a háttérben sem gyűjtjük.',
          '**Értesítési azonosító:** ha engedélyezed az értesítéseket, a készülékedhez tartozó egyedi értesítési azonosítót (push token) a fiókodhoz kapcsolva tároljuk. Kizárólag arra használjuk, hogy értesítést tudjunk küldeni neked; az értesítések kikapcsolásakor vagy kijelentkezéskor töröljük.',
        ] },
        { h3: 'Automatikusan' },
        { ul: [
          '**Alapvető technikai adatok:** az alkalmazás működéséhez és a hibák elhárításához szükséges szokásos naplóbejegyzések (pl. eszköztípus, hibajelentések).',
        ] },
        { h2: 'Mire használjuk az adatokat' },
        { ul: [
          'A termékek vonalkód alapú párosítására és a bolti árak összehasonlítására.',
          'A hozzád legközelebbi és legkedvezőbb üzlet megmutatására.',
          'A fiókod létrehozására, a bejelentkezésre és az e-mail-cím megerősítésére.',
          'A kérdéseid megválaszolására a Cheep Asszisztensen keresztül.',
          'Az alkalmazás fejlesztésére és biztonságának megőrzésére.',
        ] },
        { h2: 'Megosztás harmadik felekkel' },
        { p: 'Az adataidat marketingcélból nem adjuk el. Csak ott osztjuk meg őket korlátozott körben, ahol ez a szolgáltatás működéséhez szükséges:' },
        { ul: [
          '**Cheep Asszisztens (mesterséges intelligencia):** az asszisztensnek írt üzeneteid a válasz elkészítéséhez a Google Gemini szolgáltatásához kerülnek.',
          '**E-mail:** a megerősítő és tájékoztató e-maileket a Resend infrastruktúráján keresztül küldjük.',
          '**Átirányítás boltokhoz:** ha egy bolthoz tartozó hivatkozásra koppintasz, az adott bolt oldalára jutsz; ekkor nem adunk át személyes adatot.',
          '**Jogi kötelezettség:** az adatok az illetékes hatóságokkal megoszthatók, ha ezt jogszabály írja elő.',
        ] },
        { h2: 'Az adatok biztonsága' },
        { p: 'Az alkalmazás és a szervereink közötti teljes forgalom HTTPS (TLS) protokollal titkosított. A jelszavakat bcrypt algoritmussal hasheljük. Ugyanakkor emlékeztetünk, hogy az interneten történő adattovábbítás soha nem 100%-osan biztonságos.' },
        { h2: 'Az adatok megőrzése és törlése' },
        { p: 'Az adataidat addig őrizzük meg, amíg a fiókod aktív. Bármikor véglegesen törölheted a fiókodat és a hozzá kapcsolódó összes adatot:' },
        { ul: [
          'az alkalmazásban a **Profil → Fiókom törlése** lépéssel, vagy',
          'a [cheep.live/hu/delete](/delete) oldalon lévő űrlappal.',
        ] },
        { p: 'A törlés nem vonható vissza; véglegesen eltűnik minden adatod, köztük a listáid, a kedvenc boltjaid, a visszajelzéseid és az asszisztenssel folytatott beszélgetéseid.' },
        { h2: 'A jogaid (GDPR)' },
        { p: 'Jogod van hozzáférni az adataidhoz, kérni a helyesbítésüket vagy törlésüket, valamint tiltakozni a kezelésük ellen. E jogaid gyakorlásához írj a [gizlilik@cheep.live](mailto:gizlilik@cheep.live) címre.' },
        { h2: 'Gyermekek' },
        { p: 'A Cheep nem 13 év alatti gyermekeknek szól, és tudatosan nem gyűjt tőlük adatot.' },
        { h2: 'Változások' },
        { p: 'Ezt a tájékoztatót időről időre frissíthetjük. A lényeges változásokról az alkalmazásban vagy e-mailben tájékoztatunk. A hatályos változat mindig ezen az oldalon található.' },
        { h2: 'Kapcsolat' },
        { p: 'Kérdés esetén: [gizlilik@cheep.live](mailto:gizlilik@cheep.live)' },
      ],
    },

    terms: {
      title: 'Felhasználási feltételek',
      updated: '2026. augusztus 25.',
      blocks: [
        { p: 'A Cheep használatával elfogadod ezeket a feltételeket. A Cheep egy tájékoztató jellegű eszköz a bolti árak összehasonlításához.' },
        { h2: 'A szolgáltatás jellege' },
        { ul: [
          'Az árakat rendszeresen gyűjtjük az áruházláncok nyilvánosan elérhető forrásaiból, és naponta frissítjük őket.',
          'Az árak tájékoztató jellegűek, és eltérhetnek a boltban érvényes ártól. A kötelező érvényű ár a pénztárnál fizetendő ár.',
          'A Cheep nem értékesítési pont: nem árul terméket, és nem fogad el fizetést.',
        ] },
        { h2: 'A fiókod' },
        { ul: [
          'A regisztrációkor valós adatokat adj meg; a fiókod biztonságáért te felelsz.',
          'A fiókodat bármikor [törölheted](/delete).',
        ] },
        { h2: 'Márkanevek és szellemi tulajdon' },
        { ul: [
          'Az alkalmazásban szereplő összes bolt- és terméknév, valamint logó a jogosultja bejegyzett védjegye. Ezeket a neveket kizárólag azért használjuk, hogy **jelöljük, melyik bolt árát mutatjuk** (tisztességes, hivatkozási célú használat).',
          'A Cheep **nem áll hivatalos partneri kapcsolatban, kapcsoltsági viszonyban vagy együttműködésben** a megnevezett áruházláncokkal, és azok nem is támogatják.',
          'Az árinformációk nyilvános forrásokból származnak. Ha egy védjegyjogosult kifogást szeretne emelni a tartalommal kapcsolatban, a [destek@cheep.live](mailto:destek@cheep.live) címen érhet el minket; a megalapozott megkeresésekre gyorsan reagálunk.',
        ] },
        { h2: 'Cheep Premium előfizetés' },
        { p: 'A Cheep árösszehasonlítás, bevásárlólista, legolcsóbb útvonal és árcsökkenési értesítés funkciói ingyenesek, és azok is maradnak. Az ingyenes változat hirdetéseket jelenít meg. A Cheep Premium egy opcionális előfizetés, amely eltávolítja a hirdetéseket, és megnöveli az MI-asszisztens üzenetkeretét.' },
        { ul: [
          '**Tartalom:** Az ingyenes használat során naponta 5 üzenet küldhető az asszisztensnek, és az alkalmazás hirdetéseket jelenít meg. A Premiummal havi 300 üzenet küldhető (napi 50 üzenetes biztonsági korláttal), a hirdetések pedig teljesen eltűnnek. Minden más funkció mindkét esetben azonos.',
          '**Időtartam és ár:** Az előfizetés havi vagy éves konstrukcióban érhető el. Az érvényes árat, a pénznemet és az időszakot az alkalmazás vásárlási képernyője a vásárlás előtt egyértelműen megmutatja; ezek országonként eltérhetnek.',
          '**Automatikus megújulás:** Az előfizetés automatikusan megújul, kivéve, ha az aktuális időszak vége előtt legalább 24 órával lemondod. A díjat a megújulást megelőző 24 órában terheljük az áruházi fiókodra.',
          '**Lemondás:** Az előfizetést bármikor lemondhatod a készüléked áruházi fiókjának előfizetési beállításaiban (App Store: Beállítások → Apple-fiók → Előfizetések; Google Play: Play Áruház → Előfizetések). A lemondás a kifizetett időszak végén lép életbe; addig továbbra is használhatod a Premium előnyeit.',
          '**Fizetés és visszatérítés:** A fizetést az az áruház szedi be, ahonnan az alkalmazást letöltötted (Apple App Store vagy Google Play); a Cheep nem látja és nem tárolja a kártyaadataidat. A visszatérítési kérelmekre az adott áruház visszatérítési szabályzata vonatkozik, és közvetlenül az áruházhoz kell benyújtani őket.',
          '**Próbaidőszak:** Ha ingyenes próbaidőszakot kínálunk, és azt a lejárta előtt nem mondod le, az előfizetés fizetősként folytatódik. A fel nem használt próbaidőszak az előfizetés megvásárlásakor megszűnik.',
        ] },
        { h2: 'A felelősség korlátozása' },
        { p: 'A Cheep nem szavatolja az árinformációk teljességét vagy naprakészségét, és nem felel az ezekre alapozott döntéseidből eredő következményekért.' },
        { h2: 'Változások' },
        { p: 'Ezeket a feltételeket frissíthetjük; a hatályos változatot mindig ezen az oldalon tesszük közzé.' },
        { h2: 'Kapcsolat' },
        { p: '[destek@cheep.live](mailto:destek@cheep.live)' },
      ],
    },

    del: {
      title: 'Fiók törlése',
      updated: '2026. július 2.',
      intro: [
        { p: 'Véglegesen törölheted a Cheep-fiókodat és **az összes adatodat** (bevásárlólisták, kedvenc boltok, ár-visszajelzések, asszisztensbeszélgetések és a profilod). Ez a művelet **nem vonható vissza**.' },
        { h2: 'Az alkalmazásból' },
        { p: 'A leggyorsabb út: a Cheep alkalmazásban válaszd a **Profil → Fiókom törlése** lehetőséget.' },
        { h2: 'Nincs meg az alkalmazás? Töröld a weben' },
        { p: 'Ha eltávolítottad az alkalmazást, az alábbi űrlapon a fiókod e-mail-címével és jelszavával igazold magad, majd töröld a fiókot. Az adatokat kizárólag az azonosításodra használjuk.' },
      ],
      emailLabel: 'E-mail',
      emailPlaceholder: 'pelda@email.hu',
      passwordLabel: 'Jelszó',
      confirmLabel: 'Tudomásul veszem, hogy a fiókom és minden adatom véglegesen törlődik, és hogy ez a művelet nem vonható vissza.',
      submit: 'Fiókom végleges törlése',
      submitting: 'Törlés…',
      deletedTitle: '✓ Törölve',
      successFallback: 'A fiókod és minden adatod véglegesen törlődött.',
      errorFallback: 'A törlés nem sikerült. Ellenőrizd az e-mail-címed és a jelszavad.',
      networkError: 'Nem sikerült elérni a szervert. Kérjük, próbáld újra később.',
      help: [
        { h2: 'Segítség' },
        { p: 'Ha gond adódna, írj a [destek@cheep.live](mailto:destek@cheep.live) címre — töröljük helyetted a fiókot.' },
      ],
    },
  },

  seo: {
    home: {
      title: 'Cheep — Bolti árösszehasonlító alkalmazás',
      description:
        'Hasonlítsd össze ugyanannak a terméknek az árát a boltokban. Vidd át a bevásárlólistád a legolcsóbb boltba, és spórolj minden kosáron. Töltsd le ingyen.',
    },
    privacy: {
      title: 'Adatvédelmi tájékoztató — Cheep',
      description:
        'Milyen adatokat gyűjt a Cheep, miért gyűjti őket, és milyen jogaid vannak? GDPR-nak megfelelő adatvédelmi tájékoztatónk.',
    },
    terms: {
      title: 'Felhasználási feltételek — Cheep',
      description:
        'A Cheep felhasználási feltételei: a szolgáltatás jellege, az árinformációk forrása, a márkanevek és a felelősség korlátozása.',
    },
    del: {
      title: 'Fiók törlése — Cheep',
      description:
        'Töröld véglegesen a Cheep-fiókodat és minden adatodat — az alkalmazásból vagy az ezen az oldalon lévő űrlappal.',
    },
    appDescription:
      'A Cheep egy ingyenes bevásárlóalkalmazás, amely vonalkód alapján hasonlítja össze a boltok árait. Átviszi a bevásárlólistád a legolcsóbb boltba, és megmutatja a legközelebbi üzletet.',
  },
}
