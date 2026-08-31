import type { Dict } from './types'

export const ro: Dict = {
  htmlLang: 'ro',
  ogLocale: 'ro_RO',

  notFound: {

    title: 'Pagina nu a fost găsită — Cheep',

    description: 'Nu am găsit această pagină.',

  },


  nav: {
    links: [
      { label: 'Produse', href: '/produse' },
      { label: 'Cum funcționează', href: '#how' },
      { label: 'Economii', href: '#savings' },
      { label: 'Țări', href: '#coverage' },
      { label: 'Funcții', href: '#features' },
      { label: 'Întrebări frecvente', href: '#faq' },
    ],
    download: 'Descarcă',
    openMenu: 'Deschide meniul',
    closeMenu: 'Închide meniul',
    home: 'Cheep — pagina principală',
    langMenuLabel: 'Alege limba',
  },

  hero: {
    badge: 'Live în 5 țări · 120.000+ produse',
    titleLine1: 'Același produs.',
    titleLine2: 'Cel mai mic preț.',
    sub: 'Cheep compară prețurile din magazine, unul câte unul, și îți mută lista de cumpărături în cel mai ieftin coș. Prețuri reale, actualizate zilnic — economisești fără să stai pe gânduri.',
    ctaPrimary: 'Descarcă aplicația',
    ctaSecondary: 'Cum funcționează?',
    // Prețuri exemplificative. Ultima poziție este cea mai ieftină.
    ticker: [
      { product: 'Lapte 1 l', prices: ['Mega Image 8,49 lei', 'Carrefour 7,99 lei', 'Kaufland 7,49 lei'] },
      { product: 'Ouă 10 buc.', prices: ['Auchan 16,99 lei', 'Carrefour 15,99 lei', 'Lidl 14,99 lei'] },
      { product: 'Ulei de floarea-soarelui 1 l', prices: ['Mega Image 10,49 lei', 'Penny 9,49 lei', 'Kaufland 8,99 lei'] },
      { product: 'Pâine', prices: ['Mega Image 6,49 lei', 'Carrefour 5,49 lei', 'Lidl 4,99 lei'] },
      { product: 'Cafea 250 g', prices: ['Auchan 28,99 lei', 'Carrefour 26,49 lei', 'Penny 24,99 lei'] },
    ],
    tagCheapestPrice: '₺27,90',
    tagCheapest: '✓ cel mai ieftin',
    tagSaving: '18% economie',
  },

  compare: {
    eyebrow: 'Date publice · actualizate zilnic',
    titleLead: 'Același produs,',
    titleAccent: 'alt preț în fiecare magazin.',
    body: 'Pentru un singur litru de lapte poți plăti cu 10–15% mai mult, de la un magazin la altul. Cheep pune prețurile aceluiași produs din toate lanțurile unul lângă altul și îți arată în câteva secunde cel mai ieftin — fără presupuneri și fără drumuri în plus.',
    sourceNote: 'Date din sistemul de stat Monitorul Prețurilor · actualizate zilnic',
    card: {
      name: 'Lapte integral 3,5%',
      unit: '1 l · aceeași marcă, același produs',
      emoji: '🥛',
      rows: [
        { store: 'Mega Image', price: '8,49 lei', color: '#0057A6' },
        { store: 'Auchan', price: '7,99 lei', color: '#E2001A' },
        { store: 'Carrefour', price: '7,89 lei', color: '#004E9F' },
        { store: 'Kaufland', price: '7,49 lei', cheapest: true, color: '#E10915' },
      ],
      cheapestBadge: 'Cel mai ieftin',
      savingLabel: 'Economia ta la acest produs',
      savingValue: '1,00 lei · 12%',
    },
  },

  how: {
    eyebrow: 'Cum funcționează',
    title: 'Economisești în trei pași',
    sub: 'Nimic complicat. Tu dai lista, de restul se ocupă Cheep.',
    steps: [
      {
        n: '01',
        title: 'Creează-ți lista',
        body: 'Scrie ce ai de cumpărat sau caută produsele. Lapte, ouă, detergent… tot ce ai nevoie ajunge pe listă.',
      },
      {
        n: '02',
        title: 'Cheep compară',
        body: 'Potrivește fiecare produs după codul de bare și scanează prețurile actuale din toate lanțurile. În câteva secunde.',
      },
      {
        n: '03',
        title: 'Mergi unde e mai ieftin',
        body: 'Mută-ți coșul în cel mai avantajos magazin și vezi cel mai apropiat punct de lucru. Afli pe loc cât ai economisit.',
      },
    ],
  },

  savings: {
    eyebrow: 'Cât înseamnă asta?',
    titleLead: 'La un coș obișnuit plătești cu',
    titleAccentSuffix: ' mai puțin',
    sub: 'Diferența medie pe care o lasă în buzunar utilizatorii care își mută lista în cel mai ieftin magazin. Pare puțin, dar într-o lună și într-un an se adună serios.',
    stats: [
      { key: 'products', label: 'produse potrivite' },
      { key: 'branches', label: 'magazine în baza de date' },
      { key: 'countries', label: 'țări, o singură aplicație' },
      { key: 'updates', label: 'actualizare a prețurilor' },
    ],
    updatesValue: 'Zilnic',
  },

  coverage: {
    eyebrow: 'Acoperire',
    titleLead: 'Live în cinci țări,',
    titleAccent: 'Europa urmează',
    sub: 'Turcia, Polonia, Croația, Ungaria și România. Prețurile se potrivesc după codul de bare și se actualizează zilnic din date reale din magazine.',
    countries: [
      { code: 'TR', name: 'Turcia' },
      { code: 'PL', name: 'Polonia' },
      { code: 'HR', name: 'Croația' },
      { code: 'HU', name: 'Ungaria' },
      { code: 'RO', name: 'România' },
    ],
    branchesUnit: 'magazine',
    live: 'Activ',
    soon: 'În curând',
  },

  features: {
    eyebrow: 'Funcții',
    title: 'Nu doar preț, ci și cap limpede',
    sub: 'Detaliile care fac Cheep cu adevărat util.',
    items: [
      {
        emoji: '🔖',
        title: 'Prețuri potrivite după codul de bare',
        body: 'Nu „lapte”, ci exact acel lapte. Potrivim produsele după codul EAN, așa că vezi același produs, identic, în magazine diferite. Fără potriviri înșelătoare.',
      },
      {
        emoji: '📍',
        title: 'Cel mai apropiat magazin',
        body: 'Îți arată cel mai apropiat și cel mai ieftin magazin, calculând distanța reală de la locația ta.',
      },
      {
        emoji: '🤖',
        title: 'Asistentul Cheep',
        body: 'Întreabă „unde e cel mai ieftin micul dejun săptămâna asta?”, iar inteligența artificială îți face lista.',
      },
      {
        emoji: '📈',
        title: 'Istoricul prețurilor',
        body: 'Chiar s-a ieftinit produsul? Vezi prețul de dinainte și nu te lăsa păcălit de promoție.',
      },
      {
        emoji: '🧺',
        title: 'Liste inteligente',
        body: 'Fă-ți coșul și vezi dintr-o privire cât iese totalul în fiecare magazin.',
      },
    ],
  },

  faq: {
    eyebrow: 'Întrebări frecvente',
    title: 'Bine de știut',
    sub: 'De la sursa prețurilor din Cheep, până la cât costă aplicația.',
    items: [
      {
        q: 'Ce este Cheep și la ce folosește?',
        a: 'Cheep este o aplicație gratuită de cumpărături care compară prețurile din magazinele alimentare. Îți creezi lista de cumpărături, iar Cheep compară fiecare produs între lanțuri, îți arată cât costă lista în fiecare magazin și îți pune în față cel mai ieftin coș.',
      },
      {
        q: 'De unde vin prețurile și cât de des se actualizează?',
        a: 'În România, prețurile provin din sistemul de stat Monitorul Prețurilor, în Ungaria din sistemul oficial de monitorizare a prețurilor al autorității de concurență (GVH), în Turcia din sursa oficială publică a Ministerului Comerțului (marketfiyati.org.tr), iar în Polonia și Croația din listele de prețuri publicate de lanțurile de magazine. Prețurile se actualizează zilnic. Au caracter informativ și pot diferi de prețul de la casă.',
      },
      {
        q: 'Prețurile căror magazine le comparați?',
        a: 'În România: Kaufland, Lidl, Carrefour, Auchan, Mega Image și Penny. În Turcia: Migros, A101, BİM, ŞOK, CarrefourSA și Tarım Kredi. În Polonia: Biedronka, Lidl, Żabka, Auchan și Carrefour. În Croația: Konzum, Lidl, Spar, Plodine, Kaufland și Tommy. În Ungaria: Tesco, Lidl, Aldi, Auchan și Penny. În total acoperim peste 27.500 de magazine.',
      },
      {
        q: 'Aplicația este gratuită?',
        a: 'Da. Descărcarea și folosirea Cheep sunt gratuite: compararea prețurilor, listele, ruta cea mai ieftină și notificările de scădere a prețului rămân mereu gratuite. În varianta gratuită afișăm în câteva locuri reclame mici. Abonamentul opțional Cheep Premium le elimină complet și mărește cota de mesaje către asistentul AI; condițiile sunt în Termenii de utilizare.',
      },
      {
        q: 'De unde știți că este exact același produs?',
        a: 'Potrivim produsele după codul de bare EAN, nu după denumire. Adică nu se compară „lapte” cu „lapte”, ci exact aceeași marcă, același gramaj, același produs. Fără potriviri înșelătoare.',
      },
      {
        q: 'În ce țări pot folosi aplicația? Există versiune pentru iPhone?',
        a: 'Cheep este activ momentan în România, Turcia, Polonia, Croația și Ungaria; Germania, Elveția și Suedia urmează. Aplicația se descarcă atât din Google Play, cât și din App Store.',
      },
    ],
  },

  download: {
    titleLead: 'Următorul tău coș,',
    titleAccent: 'mai ieftin',
    sub: 'Descarcă Cheep, creează-ți lista și vezi economia. Gratuit în cinci țări.',
    playAlt: 'Descarcă din Google Play',
    appStoreAlt: 'Descarcă din App Store',
    note: 'Descărcare gratuită · fără reclame cu Premium opțional · Android 8.0 și iOS 15.1 sau mai nou',
  },

  footer: {
    tagline: 'Același produs, cel mai mic preț. Compară prețurile din magazine și economisește la fiecare coș.',
    cols: [
      {
        title: 'Produs',
        links: [
          { label: 'Cum funcționează', href: '#how' },
          { label: 'Funcții', href: '#features' },
          { label: 'Țări', href: '#coverage' },
          { label: 'Întrebări frecvente', href: '#faq' },
          { label: 'Descarcă', href: '#download' },
        ],
      },
      {
        title: 'Prețuri',
        links: [
          { label: 'Raport de prețuri', href: '/raport-preturi' },
          { label: 'Cel mai ieftin magazin', href: '/cel-mai-ieftin-magazin' },
        ],
      },
      {
        title: 'Informații legale',
        links: [
          { label: 'Politica de confidențialitate', href: '/privacy' },
          { label: 'Ștergerea contului', href: '/delete' },
          { label: 'Termeni de utilizare', href: '/terms' },
        ],
      },
      {
        title: 'Contact',
        links: [
          { label: 'destek@cheep.live', href: 'mailto:destek@cheep.live' },
          { label: 'gizlilik@cheep.live', href: 'mailto:gizlilik@cheep.live' },
        ],
      },
    ],
    disclaimer:
      'Toate denumirile și siglele de marcă sunt mărci înregistrate ale deținătorilor lor. Cheep nu are un parteneriat oficial și nu colaborează cu aceste lanțuri de magazine; denumirile mărcilor sunt folosite exclusiv pentru a indica al cărui magazin este prețul afișat. În România, prețurile provin din sistemul Monitorul Prețurilor, în Ungaria din sistemul oficial al GVH, în Turcia din sursa oficială publică a Ministerului Comerțului (marketfiyati.org.tr), iar în Polonia și Croația din listele de prețuri publicate de magazine; au caracter informativ și pot diferi de prețul de la casă.',
    copyright: '© 2026 Cheep. Toate drepturile rezervate.',
    madeIn: 'Făcut cu drag pentru România, Turcia, Polonia, Croația și Ungaria',
  },

  legal: {
    eyebrow: 'Cheep · Informații legale',
    updatedPrefix: 'Ultima actualizare:',
    backHome: '← Pagina principală',

    privacy: {
      title: 'Politica de confidențialitate',
      updated: '2 iulie 2026',
      blocks: [
        { p: 'La Cheep („noi”, „aplicația”) îți respectăm confidențialitatea. Această politică îți explică ce date colectăm atunci când folosești aplicația mobilă Cheep și site-ul **cheep.live**, de ce le colectăm și ce drepturi ai. Cheep este o aplicație de economisire care compară prețurile din magazine; datele tale **nu le vindem**.' },
        { h2: 'Datele pe care le colectăm' },
        { h3: 'Pentru că ni le dai tu' },
        { ul: [
          '**Datele contului:** adresa ta de e-mail, numele și parola (parola nu este stocată niciodată în clar, ci este criptată ireversibil cu bcrypt).',
          '**Preferințe:** țara și limba alese.',
          '**Conținut din aplicație:** listele de cumpărături pe care le creezi, magazinele tale favorite, sesizările de preț trimise și mesajele scrise către Asistentul Cheep.',
        ] },
        { h3: 'Când îți dai acordul' },
        { ul: [
          '**Locația:** folosită numai cu acordul tău și doar pentru a-ți arăta cele mai apropiate magazine și distanțele reale. În acest scop, coordonatele dispozitivului tău sunt transmise serverului nostru. Locația nu este urmărită continuu și nu este colectată în fundal.',
          '**Identificatorul de notificări:** dacă permiți notificările, un identificator unic al dispozitivului tău (token push) este stocat și asociat contului tău. Este folosit exclusiv pentru a-ți trimite notificări; se șterge atunci când dezactivezi notificările sau te deconectezi.',
        ] },
        { h3: 'Automat' },
        { ul: [
          '**Date tehnice de bază:** jurnalele standard necesare pentru funcționarea aplicației și remedierea erorilor (de ex. tipul dispozitivului, rapoartele de eroare).',
        ] },
        { h2: 'De ce folosim datele' },
        { ul: [
          'Pentru a potrivi produsele după codul de bare și a compara prețurile din magazine.',
          'Pentru a-ți arăta cel mai apropiat și cel mai avantajos magazin.',
          'Pentru a-ți crea contul, a-ți permite autentificarea și verificarea adresei de e-mail.',
          'Pentru a-ți răspunde la întrebări prin Asistentul Cheep.',
          'Pentru a dezvolta aplicația și a-i menține securitatea.',
        ] },
        { h2: 'Partajarea cu terți' },
        { p: 'Nu îți vindem datele în scopuri de marketing. Există doar partajări limitate, strict necesare pentru funcționarea serviciului:' },
        { ul: [
          '**Asistentul Cheep (inteligență artificială):** mesajele pe care le scrii asistentului sunt transmise serviciului Gemini al Google pentru a genera răspunsul.',
          '**E-mail:** mesajele de verificare și cele informative sunt trimise prin infrastructura Resend.',
          '**Redirecționări către magazine:** când atingi un link către un magazin, ești redirecționat pe site-ul acestuia; în acest proces nu îți sunt partajate datele personale.',
          '**Obligație legală:** datele pot fi partajate cu autoritățile competente atunci când legea o cere.',
        ] },
        { h2: 'Securitatea datelor' },
        { p: 'Tot traficul dintre aplicație și serverele noastre este criptat prin HTTPS (TLS). Parolele sunt hash-uite cu bcrypt. Îți reamintim totuși că nicio transmisie prin internet nu este 100% sigură.' },
        { h2: 'Păstrarea și ștergerea datelor' },
        { p: 'Îți păstrăm datele atât timp cât contul tău este activ. Îți poți șterge definitiv contul și toate datele asociate oricând:' },
        { ul: [
          'din aplicație, de la **Profil → Șterge-mi contul**, sau',
          'din formularul de pe pagina [cheep.live/ro/delete](/delete).',
        ] },
        { p: 'Ștergerea nu poate fi anulată; toate datele tale dispar definitiv, inclusiv listele, magazinele favorite, sesizările și conversațiile cu asistentul.' },
        { h2: 'Drepturile tale (GDPR)' },
        { p: 'Ai dreptul de a-ți accesa datele, de a cere rectificarea sau ștergerea lor și de a te opune prelucrării. Pentru a-ți exercita aceste drepturi, scrie-ne la [gizlilik@cheep.live](mailto:gizlilik@cheep.live).' },
        { h2: 'Copii' },
        { p: 'Cheep nu se adresează copiilor sub 13 ani și nu colectează cu bună știință date de la aceștia.' },
        { h2: 'Modificări' },
        { p: 'Putem actualiza această politică din când în când. La modificări importante te informăm prin aplicație sau prin e-mail. Versiunea actuală se află întotdeauna pe această pagină.' },
        { h2: 'Contact' },
        { p: 'Întrebări: [gizlilik@cheep.live](mailto:gizlilik@cheep.live)' },
      ],
    },

    terms: {
      title: 'Termeni de utilizare',
      updated: '25 august 2026',
      blocks: [
        { p: 'Folosind Cheep, accepți acești termeni. Cheep este un instrument informativ care te ajută să compari prețurile din magazine.' },
        { h2: 'Natura serviciului' },
        { ul: [
          'Prețurile sunt colectate periodic din sursele publice ale magazinelor și sunt actualizate zilnic.',
          'Prețurile au caracter informativ și pot diferi de prețul valabil în magazin. Obligatoriu este prețul de la casa magazinului.',
          'Cheep nu este un punct de vânzare; nu vinde produse și nu încasează plăți.',
        ] },
        { h2: 'Contul tău' },
        { ul: [
          'Trebuie să te înregistrezi cu date corecte, iar de securitatea contului răspunzi tu.',
          'Îți poți [șterge](/delete) contul oricând.',
        ] },
        { h2: 'Mărci și proprietate intelectuală' },
        { ul: [
          'Toate denumirile și siglele magazinelor și produselor care apar în aplicație sunt mărci înregistrate ale deținătorilor lor. Aceste denumiri sunt folosite exclusiv pentru a **indica al cărui magazin este prețul afișat**, cu titlu de referință (utilizare loială).',
          'Cheep **nu are un parteneriat oficial, o legătură sau o colaborare** cu magazinele menționate și nu este susținut de acestea.',
          'Informațiile despre prețuri sunt colectate din surse publice. Orice deținător de marcă ce dorește să ridice o pretenție legată de conținut ne poate contacta la [destek@cheep.live](mailto:destek@cheep.live); răspundem prompt solicitărilor întemeiate.',
        ] },
        { h2: 'Abonamentul Cheep Premium' },
        { p: 'Compararea prețurilor, lista de cumpărături, ruta cea mai ieftină și notificările de scădere a prețului din Cheep sunt gratuite și vor rămâne gratuite. Varianta gratuită afișează reclame. Cheep Premium este un abonament opțional care elimină reclamele și mărește cota de mesaje a asistentului AI.' },
        { ul: [
          '**Ce include:** În varianta gratuită se pot trimite asistentului 5 mesaje pe zi, iar aplicația afișează reclame. Cu Premium se pot trimite 300 de mesaje pe lună (cu o limită de siguranță de 50 de mesaje pe zi), iar reclamele dispar complet. Toate celelalte funcții sunt identice în ambele situații.',
          '**Durată și preț:** Abonamentul este oferit lunar sau anual. Prețul valabil, moneda și perioada sunt afișate clar pe ecranul de achiziție din aplicație, înainte de cumpărare, și pot varia în funcție de țară.',
          '**Reînnoire automată:** Abonamentul se reînnoiește automat, dacă nu este anulat cu cel puțin 24 de ore înainte de expirare. Suma este încasată din contul de magazin în cele 24 de ore dinaintea reînnoirii.',
          '**Anulare:** Poți anula abonamentul oricând, din setările de abonamente ale contului de magazin de pe dispozitivul tău (App Store: Setări → Apple ID → Abonamente; Google Play: Magazin Play → Abonamente). Anularea intră în vigoare la sfârșitul perioadei plătite în curs; până atunci continui să beneficiezi de drepturile Premium.',
          '**Plată și rambursare:** Plata este încasată de magazinul din care ai descărcat aplicația (Apple App Store sau Google Play); Cheep nu vede și nu stochează datele cardului. Cererile de rambursare se supun politicii de rambursare a magazinului respectiv și se transmit direct acestuia.',
          '**Perioadă de probă:** Atunci când este oferită o probă gratuită, dacă nu este anulată înainte de încheierea acesteia, abonamentul continuă contra cost. Partea neutilizată din perioada de probă se încheie în momentul achiziționării abonamentului.',
        ] },
        { h2: 'Limitarea răspunderii' },
        { p: 'Cheep nu garantează caracterul complet sau actualitatea informațiilor despre prețuri și nu poate fi tras la răspundere pentru consecințele deciziilor luate pe baza acestora.' },
        { h2: 'Modificări' },
        { p: 'Putem actualiza acești termeni; versiunea actuală este publicată întotdeauna pe această pagină.' },
        { h2: 'Contact' },
        { p: '[destek@cheep.live](mailto:destek@cheep.live)' },
      ],
    },

    del: {
      title: 'Ștergerea contului',
      updated: '2 iulie 2026',
      intro: [
        { p: 'Îți poți șterge definitiv contul Cheep și **toate datele tale** (liste de cumpărături, magazine favorite, sesizări de preț, conversații cu asistentul și profilul). Această operațiune **nu poate fi anulată**.' },
        { h2: 'Din aplicație' },
        { p: 'Cea mai rapidă cale: în aplicația Cheep, urmează pașii **Profil → Șterge-mi contul**.' },
        { h2: 'Nu mai ai aplicația? Șterge contul de pe site' },
        { p: 'Dacă ai dezinstalat aplicația, confirmă-ți identitatea introducând mai jos adresa de e-mail și parola contului, apoi șterge-l. Datele sunt folosite exclusiv pentru verificarea identității.' },
      ],
      emailLabel: 'E-mail',
      emailPlaceholder: 'exemplu@email.com',
      passwordLabel: 'Parolă',
      confirmLabel: 'Înțeleg că respectivul cont și toate datele mele vor fi șterse definitiv și că această operațiune nu poate fi anulată.',
      submit: 'Șterge-mi definitiv contul',
      submitting: 'Se șterge…',
      deletedTitle: '✓ Șters',
      successFallback: 'Contul tău și toate datele tale au fost șterse definitiv.',
      errorFallback: 'Ștergerea nu a reușit. Verifică adresa de e-mail și parola.',
      networkError: 'Nu am putut contacta serverul. Te rugăm să încerci mai târziu.',
      help: [
        { h2: 'Ajutor' },
        { p: 'Dacă întâmpini probleme, scrie-ne la [destek@cheep.live](mailto:destek@cheep.live) și îți ștergem noi contul.' },
      ],
    },
  },

  seo: {
    home: {
      title: 'Cheep — Aplicația de comparat prețurile din magazine',
      description:
        'Compară prețul aceluiași produs în Kaufland, Carrefour, Auchan, Lidl și Mega Image. Mută-ți lista de cumpărături în cel mai ieftin magazin și economisește la fiecare coș. Descarcă gratuit.',
    },
    privacy: {
      title: 'Politica de confidențialitate — Cheep',
      description:
        'Ce date colectează Cheep, de ce le colectează și ce drepturi ai? Politica noastră de confidențialitate, conformă cu GDPR.',
    },
    terms: {
      title: 'Termeni de utilizare — Cheep',
      description:
        'Termenii de utilizare Cheep: natura serviciului, sursa informațiilor despre prețuri, mărcile și limitarea răspunderii.',
    },
    del: {
      title: 'Ștergerea contului — Cheep',
      description:
        'Șterge definitiv contul Cheep și toate datele tale — din aplicație sau prin formularul de pe această pagină.',
    },
    appDescription:
      'Cheep este o aplicație gratuită de cumpărături care compară prețurile din magazine după codul de bare. Îți mută lista de cumpărături în cel mai ieftin magazin și îți arată cel mai apropiat punct de lucru.',
  },
}
