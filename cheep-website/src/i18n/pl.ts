import type { Dict } from './types'

export const pl: Dict = {
  htmlLang: 'pl',
  ogLocale: 'pl_PL',

  nav: {
    links: [
      { label: 'Jak to działa', href: '#how' },
      { label: 'Oszczędności', href: '#savings' },
      { label: 'Kraje', href: '#coverage' },
      { label: 'Funkcje', href: '#features' },
      { label: 'FAQ', href: '#faq' },
    ],
    download: 'Pobierz',
    openMenu: 'Otwórz menu',
    closeMenu: 'Zamknij menu',
    home: 'Cheep — strona główna',
    langSwitchTo: 'Türkçe',
  },

  hero: {
    badge: 'Działa w Polsce i Turcji · 5 krajów',
    titleLine1: 'Ten sam produkt.',
    titleLine2: 'Najniższa cena.',
    sub: 'Cheep porównuje ceny w sklepach spożywczych i przenosi Twoją listę zakupów do najtańszego koszyka. Prawdziwe ceny aktualizowane codziennie — oszczędzasz bez zastanawiania się.',
    ctaPrimary: 'Pobierz aplikację',
    ctaSecondary: 'Jak to działa?',
    // Ceny przykładowe. Ostatnia pozycja to najtańsza.
    ticker: [
      { product: 'Mleko 1 L', prices: ['Żabka 4,29 zł', 'Lidl 3,59 zł', 'Biedronka 3,49 zł'] },
      { product: 'Jaja 10 szt.', prices: ['Auchan 13,99 zł', 'Biedronka 13,49 zł', 'Lidl 12,99 zł'] },
      { product: 'Masło 200 g', prices: ['Carrefour 8,99 zł', 'Biedronka 8,49 zł', 'Auchan 7,99 zł'] },
      { product: 'Chleb', prices: ['Żabka 5,49 zł', 'Lidl 4,49 zł', 'Biedronka 4,29 zł'] },
      { product: 'Kawa 500 g', prices: ['Biedronka 27,49 zł', 'Carrefour 26,99 zł', 'Lidl 24,99 zł'] },
    ],
    tagCheapest: '✓ najtaniej',
    tagSaving: '18% taniej',
  },

  compare: {
    eyebrow: 'Dane publiczne · aktualizacja codziennie',
    titleLead: 'Ten sam produkt,',
    titleAccent: 'inna cena w każdym sklepie.',
    body: 'Za jeden karton mleka możesz zapłacić 10–15% więcej, zależnie od sklepu. Cheep zestawia ceny tego samego produktu w sieciach i w sekundę pokazuje najtańszą — bez zgadywania i bez objeżdżania sklepów.',
    sourceNote: 'W Polsce dane z publicznych źródeł sieci handlowych · aktualizacja codziennie',
    card: {
      name: 'Mleko UHT 3,2%',
      unit: '1 L · ta sama marka, ten sam produkt',
      emoji: '🥛',
      rows: [
        { store: 'Żabka', price: '4,29 zł', color: '#00A650' },
        { store: 'Auchan', price: '3,99 zł', color: '#E2001A' },
        { store: 'Lidl', price: '3,59 zł', color: '#0050AA' },
        { store: 'Biedronka', price: '3,49 zł', cheapest: true, color: '#FFC400' },
      ],
      cheapestBadge: 'Najtaniej',
      savingLabel: 'Twoja oszczędność',
      savingValue: '0,80 zł · 19%',
    },
  },

  how: {
    eyebrow: 'Jak to działa',
    title: 'Oszczędzasz w trzech krokach',
    sub: 'Nic skomplikowanego. Ty dajesz listę, resztą zajmuje się Cheep.',
    steps: [
      {
        n: '01',
        title: 'Stwórz listę',
        body: 'Wpisz, co kupujesz, albo wyszukaj produkty. Mleko, jajka, proszek do prania… wszystko trafia na listę.',
      },
      {
        n: '02',
        title: 'Cheep porównuje',
        body: 'Dopasowuje każdy produkt po kodzie kreskowym i skanuje aktualne ceny we wszystkich sieciach. W kilka sekund.',
      },
      {
        n: '03',
        title: 'Idź tam, gdzie taniej',
        body: 'Przenieś koszyk do najtańszego sklepu i zobacz najbliższy oddział. Od razu wiesz, ile zaoszczędzisz.',
      },
    ],
  },

  savings: {
    eyebrow: 'Ile to daje?',
    titleLead: 'W przeciętnym koszyku zapłacisz o',
    titleAccentSuffix: ' mniej',
    sub: 'Średnia różnica, jaką zostawiają użytkownicy, przenosząc listę do najtańszego sklepu. Wygląda niepozornie, ale w skali miesiąca i roku robi się z tego konkretna kwota.',
    stats: [
      { key: 'products', label: 'dopasowanych produktów' },
      { key: 'branches', label: 'sklepów w bazie' },
      { key: 'countries', label: 'kraje, jedna aplikacja' },
      { key: 'updates', label: 'aktualizacja cen' },
    ],
    updatesValue: 'Codziennie',
  },

  coverage: {
    eyebrow: 'Zasięg',
    titleLead: 'Działamy w Polsce i Turcji,',
    titleAccent: 'Europa w drodze',
    sub: 'Ten sam silnik działa w pięciu krajach. Ceny dopasowujemy po kodzie kreskowym i aktualizujemy codziennie prawdziwymi danymi ze sklepów.',
    countries: [
      { code: 'TR', name: 'Turcja' },
      { code: 'PL', name: 'Polska' },
      { code: 'DE', name: 'Niemcy' },
      { code: 'CH', name: 'Szwajcaria' },
      { code: 'SE', name: 'Szwecja' },
    ],
    branchesUnit: 'sklepów',
    live: 'Na żywo',
    soon: 'Wkrótce',
  },

  features: {
    eyebrow: 'Funkcje',
    title: 'Nie tylko cena — także rozsądek',
    sub: 'Szczegóły, dzięki którym Cheep naprawdę się przydaje.',
    items: [
      {
        emoji: '🔖',
        title: 'Ceny dopasowane po kodzie kreskowym',
        body: 'Nie „mleko”, tylko to mleko. Dopasowujemy produkty po kodzie EAN, więc porównujesz dokładnie ten sam produkt w różnych sklepach. Żadnych mylących dopasowań.',
      },
      {
        emoji: '📍',
        title: 'Najbliższy sklep',
        body: 'Pokazuje najbliższy i najtańszy sklep, licząc rzeczywistą odległość od Twojej lokalizacji.',
      },
      {
        emoji: '🤖',
        title: 'Asystent Cheep',
        body: 'Zapytaj „gdzie w tym tygodniu najtaniej na śniadanie?”, a sztuczna inteligencja ułoży listę.',
      },
      {
        emoji: '📈',
        title: 'Historia cen',
        body: 'Czy produkt naprawdę staniał? Sprawdź wcześniejszą cenę i nie daj się nabrać na promocję.',
      },
      {
        emoji: '🧺',
        title: 'Inteligentne listy',
        body: 'Stwórz koszyk i zobacz na jednym ekranie, ile wychodzi w każdym sklepie.',
      },
    ],
  },

  faq: {
    eyebrow: 'Najczęstsze pytania',
    title: 'Dobrze wiedzieć',
    sub: 'Od tego, skąd Cheep bierze ceny, po to, ile kosztuje aplikacja.',
    items: [
      {
        q: 'Czym jest Cheep i do czego służy?',
        a: 'Cheep to bezpłatna aplikacja zakupowa, która porównuje ceny w sklepach spożywczych. Tworzysz listę zakupów, a Cheep porównuje każdy produkt między sieciami, pokazuje, ile lista kosztuje w każdym sklepie, i podsuwa najtańszy koszyk.',
      },
      {
        q: 'Skąd pochodzą ceny i jak często są aktualizowane?',
        a: 'W Polsce ceny zbieramy z publicznie dostępnych źródeł sieci handlowych, a w Turcji z oficjalnego, publicznego źródła tureckiego Ministerstwa Handlu. Ceny aktualizujemy codziennie. Mają charakter informacyjny i mogą różnić się od ceny przy kasie.',
      },
      {
        q: 'Ceny których sklepów porównujecie?',
        a: 'W Polsce: Biedronka, Lidl, Żabka, Auchan i Carrefour. W Turcji: Migros, A101, BİM, ŞOK, CarrefourSA i Tarım Kredi. Łącznie obejmujemy ponad 23 500 sklepów.',
      },
      {
        q: 'Czy aplikacja jest darmowa?',
        a: 'Tak. Pobranie i korzystanie z Cheep jest całkowicie bezpłatne. Bez abonamentu i bez opłat za podgląd cen.',
      },
      {
        q: 'Skąd wiadomo, że to ten sam produkt?',
        a: 'Dopasowujemy produkty po kodzie kreskowym EAN, a nie po nazwie. Porównywana jest dokładnie ta sama marka, ta sama gramatura i ten sam produkt — bez mylących dopasowań.',
      },
      {
        q: 'W jakich krajach mogę korzystać? Czy jest wersja na iPhone’a?',
        a: 'Cheep działa obecnie w Polsce i Turcji; Niemcy, Szwajcaria i Szwecja są w drodze. Aplikację na Androida pobierzesz z Google Play, a wersja na iOS jest w przygotowaniu.',
      },
    ],
  },

  download: {
    titleLead: 'Niech następny koszyk będzie',
    titleAccent: 'tańszy',
    sub: 'Pobierz Cheep, stwórz listę, zobacz oszczędność. Bezpłatnie w Polsce i Turcji.',
    playAlt: 'Pobierz z Google Play',
    storeTop: 'Wkrótce',
    storeBottom: 'App Store',
    note: 'Bezpłatnie · bez reklam · Android 8.0 lub nowszy',
  },

  footer: {
    tagline: 'Ten sam produkt, najniższa cena. Porównuj ceny w sklepach i oszczędzaj na każdych zakupach.',
    cols: [
      {
        title: 'Produkt',
        links: [
          { label: 'Jak to działa', href: '#how' },
          { label: 'Funkcje', href: '#features' },
          { label: 'Kraje', href: '#coverage' },
          { label: 'FAQ', href: '#faq' },
          { label: 'Pobierz', href: '#download' },
        ],
      },
      {
        title: 'Informacje prawne',
        links: [
          { label: 'Polityka prywatności', href: '/privacy' },
          { label: 'Usunięcie konta', href: '/delete' },
          { label: 'Regulamin', href: '/terms' },
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
      'Wszystkie nazwy i logotypy marek są zastrzeżonymi znakami towarowymi ich właścicieli. Cheep nie jest oficjalnym partnerem tych sieci handlowych ani z nimi nie współpracuje; nazwy marek służą wyłącznie wskazaniu, czyja cena jest prezentowana. W Polsce ceny zbieramy z publicznie dostępnych źródeł sieci handlowych, a w Turcji z oficjalnego, publicznego źródła tureckiego Ministerstwa Handlu (marketfiyati.org.tr); mają charakter informacyjny i mogą różnić się od ceny przy kasie.',
    copyright: '© 2026 Cheep. Wszelkie prawa zastrzeżone.',
    madeIn: 'Zrobione z myślą o Polsce i Turcji',
  },

  legal: {
    eyebrow: 'Cheep · Informacje prawne',
    updatedPrefix: 'Ostatnia aktualizacja:',
    backHome: '← Strona główna',

    privacy: {
      title: 'Polityka prywatności',
      updated: '2 lipca 2026',
      blocks: [
        { p: 'W Cheep („my”, „aplikacja”) szanujemy Twoją prywatność. Ta polityka wyjaśnia, jakie dane zbieramy, gdy korzystasz z aplikacji mobilnej Cheep i serwisu **cheep.live**, po co je zbieramy i jakie masz prawa. Cheep to aplikacja oszczędnościowa porównująca ceny w sklepach; Twoich danych **nie sprzedajemy**.' },
        { h2: 'Jakie dane zbieramy' },
        { h3: 'Bo je podajesz' },
        { ul: [
          '**Dane konta:** adres e-mail, imię i hasło (hasło nigdy nie jest przechowywane jawnie — jest nieodwracalnie zaszyfrowane algorytmem bcrypt).',
          '**Preferencje:** wybrany kraj i język.',
          '**Treści w aplikacji:** tworzone listy zakupów, ulubione sklepy, przesyłane zgłoszenia cen oraz wiadomości pisane do Asystenta Cheep.',
        ] },
        { h3: 'Gdy wyrazisz zgodę' },
        { ul: [
          '**Przybliżona lokalizacja:** wykorzystywana wyłącznie za Twoją zgodą i tylko po to, by pokazać najbliższe sklepy. Nie śledzimy lokalizacji w sposób ciągły ani nie zbieramy jej w tle.',
        ] },
        { h3: 'Automatycznie' },
        { ul: [
          '**Podstawowe dane techniczne:** standardowe logi niezbędne do działania aplikacji i usuwania błędów (np. typ urządzenia, raporty o błędach).',
        ] },
        { h2: 'Po co wykorzystujemy dane' },
        { ul: [
          'Dopasowywanie produktów po kodzie kreskowym i porównywanie cen w sklepach.',
          'Pokazywanie najbliższego i najkorzystniejszego sklepu.',
          'Zakładanie konta, logowanie i weryfikacja adresu e-mail.',
          'Odpowiadanie na Twoje pytania przez Asystenta Cheep.',
          'Rozwój aplikacji i dbanie o jej bezpieczeństwo.',
        ] },
        { h2: 'Udostępnianie podmiotom trzecim' },
        { p: 'Nie sprzedajemy Twoich danych w celach marketingowych. Udostępniamy je w ograniczonym zakresie, wyłącznie tam, gdzie jest to niezbędne do działania usługi:' },
        { ul: [
          '**Asystent Cheep (sztuczna inteligencja):** wiadomości pisane do asystenta są przekazywane do usługi Gemini firmy Google w celu wygenerowania odpowiedzi.',
          '**Poczta e-mail:** wiadomości weryfikacyjne i informacyjne wysyłamy przez infrastrukturę Resend.',
          '**Przekierowania do sklepów:** po dotknięciu linku do sklepu zostaniesz przeniesiony na jego stronę; nie przekazujemy przy tym Twoich danych osobowych.',
          '**Obowiązek prawny:** dane mogą zostać udostępnione uprawnionym organom, jeżeli wymaga tego prawo.',
        ] },
        { h2: 'Bezpieczeństwo danych' },
        { p: 'Cały ruch między aplikacją a naszymi serwerami jest szyfrowany protokołem HTTPS (TLS). Hasła są hashowane algorytmem bcrypt. Przypominamy jednak, że żadna transmisja przez internet nie jest w 100% bezpieczna.' },
        { h2: 'Przechowywanie i usuwanie danych' },
        { p: 'Przechowujemy Twoje dane tak długo, jak długo aktywne jest Twoje konto. W każdej chwili możesz trwale usunąć konto i wszystkie powiązane z nim dane:' },
        { ul: [
          'w aplikacji: **Profil → Usuń konto**, albo',
          'przez formularz na stronie [cheep.live/pl/delete](/delete).',
        ] },
        { p: 'Usunięcia nie da się cofnąć — trwale znikają wszystkie Twoje dane, w tym listy, ulubione sklepy, zgłoszenia i rozmowy z asystentem.' },
        { h2: 'Twoje prawa (RODO)' },
        { p: 'Masz prawo dostępu do swoich danych, ich sprostowania lub usunięcia oraz wniesienia sprzeciwu wobec przetwarzania. Aby skorzystać z tych praw, napisz na [gizlilik@cheep.live](mailto:gizlilik@cheep.live).' },
        { h2: 'Dzieci' },
        { p: 'Cheep nie jest skierowany do dzieci poniżej 13. roku życia i nie zbiera świadomie ich danych.' },
        { h2: 'Zmiany' },
        { p: 'Możemy od czasu do czasu aktualizować tę politykę. O istotnych zmianach poinformujemy w aplikacji lub e-mailem. Aktualna wersja zawsze znajduje się na tej stronie.' },
        { h2: 'Kontakt' },
        { p: 'Pytania: [gizlilik@cheep.live](mailto:gizlilik@cheep.live)' },
      ],
    },

    terms: {
      title: 'Regulamin',
      updated: '2 lipca 2026',
      blocks: [
        { p: 'Korzystając z Cheep, akceptujesz niniejszy regulamin. Cheep jest narzędziem informacyjnym służącym do porównywania cen w sklepach.' },
        { h2: 'Charakter usługi' },
        { ul: [
          'Ceny są regularnie zbierane z publicznie dostępnych źródeł sieci handlowych i aktualizowane codziennie.',
          'Ceny mają charakter informacyjny i mogą różnić się od ceny obowiązującej w sklepie. Wiążąca jest cena przy kasie.',
          'Cheep nie jest punktem sprzedaży — nie sprzedaje produktów ani nie przyjmuje płatności.',
        ] },
        { h2: 'Twoje konto' },
        { ul: [
          'Rejestrując się, podaj prawdziwe dane; za bezpieczeństwo konta odpowiadasz Ty.',
          'Konto możesz [usunąć](/delete) w dowolnym momencie.',
        ] },
        { h2: 'Znaki towarowe i własność intelektualna' },
        { ul: [
          'Wszystkie nazwy i logotypy sklepów oraz produktów są zastrzeżonymi znakami towarowymi ich właścicieli. Nazwy te są używane wyłącznie po to, by **wskazać, czyja cena jest prezentowana** (dozwolony użytek informacyjny).',
          'Cheep **nie jest oficjalnym partnerem wymienionych sieci, nie jest z nimi powiązany ani przez nie wspierany**.',
          'Informacje o cenach pochodzą z publicznie dostępnych źródeł. Właściciel marki, który chce zgłosić zastrzeżenia do treści, może napisać na [destek@cheep.live](mailto:destek@cheep.live) — na uzasadnione zgłoszenia reagujemy niezwłocznie.',
        ] },
        { h2: 'Ograniczenie odpowiedzialności' },
        { p: 'Cheep nie gwarantuje kompletności ani aktualności informacji o cenach i nie ponosi odpowiedzialności za skutki decyzji podjętych na ich podstawie.' },
        { h2: 'Zmiany' },
        { p: 'Możemy aktualizować niniejszy regulamin; aktualna wersja jest zawsze publikowana na tej stronie.' },
        { h2: 'Kontakt' },
        { p: '[destek@cheep.live](mailto:destek@cheep.live)' },
      ],
    },

    del: {
      title: 'Usunięcie konta',
      updated: '2 lipca 2026',
      intro: [
        { p: 'Możesz trwale usunąć konto Cheep i **wszystkie swoje dane** (listy zakupów, ulubione sklepy, zgłoszenia cen, rozmowy z asystentem oraz profil). Tej operacji **nie da się cofnąć**.' },
        { h2: 'Z poziomu aplikacji' },
        { p: 'Najszybszy sposób: w aplikacji Cheep wybierz **Profil → Usuń konto**.' },
        { h2: 'Nie masz aplikacji? Usuń przez stronę' },
        { p: 'Jeśli aplikacja została odinstalowana, potwierdź tożsamość adresem e-mail i hasłem konta, a następnie usuń konto. Dane służą wyłącznie do weryfikacji.' },
      ],
      emailLabel: 'E-mail',
      emailPlaceholder: 'przyklad@poczta.com',
      passwordLabel: 'Hasło',
      confirmLabel: 'Rozumiem, że moje konto i wszystkie dane zostaną trwale usunięte i że tej operacji nie da się cofnąć.',
      submit: 'Trwale usuń moje konto',
      submitting: 'Usuwanie…',
      deletedTitle: '✓ Usunięto',
      successFallback: 'Twoje konto i wszystkie dane zostały trwale usunięte.',
      errorFallback: 'Usunięcie nie powiodło się. Sprawdź adres e-mail i hasło.',
      networkError: 'Nie udało się połączyć z serwerem. Spróbuj ponownie później.',
      help: [
        { h2: 'Pomoc' },
        { p: 'W razie problemów napisz na [destek@cheep.live](mailto:destek@cheep.live) — usuniemy konto za Ciebie.' },
      ],
    },
  },

  seo: {
    home: {
      title: 'Cheep — Porównywarka cen w sklepach spożywczych',
      description:
        'Porównaj ceny tego samego produktu w Biedronce, Lidlu, Żabce, Auchan i Carrefour. Przenieś listę zakupów do najtańszego sklepu i oszczędzaj. Pobierz za darmo.',
    },
    privacy: {
      title: 'Polityka prywatności — Cheep',
      description:
        'Jakie dane zbiera Cheep, po co je zbiera i jakie masz prawa? Nasza polityka prywatności zgodna z RODO.',
    },
    terms: {
      title: 'Regulamin — Cheep',
      description:
        'Regulamin Cheep: charakter usługi, źródła informacji o cenach, znaki towarowe i ograniczenie odpowiedzialności.',
    },
    del: {
      title: 'Usunięcie konta — Cheep',
      description:
        'Trwale usuń konto Cheep i wszystkie swoje dane — z poziomu aplikacji albo przez formularz na tej stronie.',
    },
    appDescription:
      'Cheep to bezpłatna aplikacja zakupowa, która porównuje ceny w sklepach po kodzie kreskowym. Przenosi listę zakupów do najtańszego sklepu i pokazuje najbliższy oddział.',
  },
}
