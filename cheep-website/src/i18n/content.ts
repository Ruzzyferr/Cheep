import type { Locale } from './index'

/**
 * İçerik (SEO) sayfalarının metinleri.
 *
 * Mevcut `Dict` yerine ayrı bir modül: o sözlük tanıtım sayfasının metinlerini
 * tutuyor ve üç dosyada birden büyümesi bakımı zorlaştırırdı. Burası tamamen
 * veri-odaklı sayfalara ait ve bağımsız evrilecek.
 *
 * Şablon yerleri `{n}`, `{name}` gibi süslü parantezle işaretli; `fill()` ile
 * doldurulur.
 */
export interface ContentDict {
  breadcrumbHome: string

  product: {
    priceTableCaption: string
    store: string
    price: string
    updated: string
    cheapest: string
    savingHeadline: string
    savingNone: string
    availability: string
    trend: string
    trendLabel: string
    similar: string
    faqTitle: string
    q1: string
    a1: string
    q2: string
    a2: string
    cta: string
    ctaBody: string
    from: string
    stores: string
    save: string
    noOffers: string
  }

  category: {
    intro: string
    introSingle: string
    byStore: string
    empty: string
  }

  /** Market x kategori sayfasi — aciklama MARKET ADINI da tasimali. */
  storeCategory: {
    intro: string
  }

  store: {
    intro: string
    branches: string
    cities: string
    products: string
    categories: string
    topDrops: string
  }

  city: {
    intro: string
    branches: string
    stores: string
    chains: string
  }

  report: {
    title: string
    lead: string
    risers: string
    fallers: string
    noData: string
    change: string
  }

  compare: {
    title: string
    lead: string
    table: string
    store: string
    products: string
    branches: string
    cheapestCount: string
  }

  browse: {
    title: string
    lead: string
    categories: string
    stores: string
    cities: string
    navLabel: string
  }

  products: {
    title: string
    lead: string
    navLabel: string
    searchPlaceholder: string
    allCategories: string
    filters: string
    stores: string
    sort: string
    sortRelevance: string
    sortPriceAsc: string
    sortPriceDesc: string
    sortSavings: string
    sortName: string
    priceRange: string
    priceMin: string
    priceMax: string
    resultCount: string
    empty: string
    clearFilters: string
    error: string
    retry: string
    loading: string
    apply: string
    close: string
    directoryTitle: string
  }

  pagination: {
    nav: string
    prev: string
    next: string
    page: string
  }
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

/**
 * Lehce COGUL uyumu.
 *
 * `fill` duz bir {k} ikamesi; Lehce ise UC bicim istiyor ve metinler tek bir
 * bicime (cogul-genitif "produktow") gomulmustu. Canliya cikan sonuc:
 * "W kategorii Gabki i scierki porownujemy 1 produktow." — hicbir anadili
 * konusanin yazmayacagi bir cumle. Sitenin Lehce iddiasi (URL'de bile Turkce
 * kelime gormesin) tam da guven ve siralama uzerineyken bu kendi ayagina
 * sikmak oluyordu.
 *
 * Kural:
 *   1                      -> tekil        (produkt)
 *   2-4, 22-24, 32-34...   -> az-cogul     (produkty)
 *   digerleri (0, 5-21...) -> cogul-genitif(produktow)
 */
export function plForm(n: number, tekil: string, azCogul: string, genitif: string): string {
  const mutlak = Math.abs(Math.trunc(n))
  if (mutlak === 1) return tekil
  const son = mutlak % 10
  const sonIki = mutlak % 100
  if (son >= 2 && son <= 4 && !(sonIki >= 12 && sonIki <= 14)) return azCogul
  return genitif
}

/** Lehce "N produkt/produkty/produktow". */
export const plUrun = (n: number): string => plForm(n, 'produkt', 'produkty', 'produktów')

/** Lehce "N sklep/sklepy/sklepow". */
export const plMarket = (n: number): string => plForm(n, 'sklep', 'sklepy', 'sklepów')

/**
 * Hirvatca sayi-cekimi.
 *
 * Kural Lehce ile AYNI (ikisi de Slav dili, ayni paucal yapisi):
 *   1, 21, 31...           -> tekil        (proizvod)
 *   2-4, 22-24...          -> az-cogul     (proizvoda)
 *   digerleri (0, 5-20...) -> cogul        (proizvoda)
 * `plForm` bu kurali zaten kodluyor; mantigi kopyalamak yerine yeniden
 * kullaniliyor -- kopyalansa ikisi zamanla ayrisirdi.
 */
export const hrForm = (n: number, tekil: string, azCogul: string, cogul: string): string =>
  plForm(n, tekil, azCogul, cogul)

/** Hirvatca "N proizvod/proizvoda". */
export const hrUrun = (n: number): string => hrForm(n, 'proizvod', 'proizvoda', 'proizvoda')

/** Hirvatca "N trgovina/trgovine/trgovina". */
export const hrMarket = (n: number): string => hrForm(n, 'trgovina', 'trgovine', 'trgovina')

/**
 * Romence sayi-cekimi.
 *
 * Romence'nin Slav dillerinden FARKLI bir kurali var: 20 ve uzerinde sayiyla
 * isim arasina "de" edati girer.
 *   1                       -> tekil            (un produs)
 *   0, 2-19                 -> cogul            (5 produse)
 *   20+ (son iki hane 0 ya  -> "de" + cogul     (20 de produse)
 *   da 20-99 olanlar)
 * 101-119 gibi sayilar son iki haneleri 1-19 oldugu icin "de" ALMAZ
 * (101 produse), 100 alir (100 de produse). Bu ayrimi atlamak metni
 * anadili konusan biri icin gorunur bicimde bozar.
 */
export function roForm(n: number, tekil: string, cogul: string): string {
  const mutlak = Math.abs(Math.trunc(n))
  if (mutlak === 1) return tekil
  if (mutlak === 0) return cogul
  const sonIki = mutlak % 100
  return sonIki === 0 || sonIki >= 20 ? `de ${cogul}` : cogul
}

/** Romence "N produs/produse/de produse". */
export const roUrun = (n: number): string => roForm(n, 'produs', 'produse')

/** Romence "N magazin/magazine/de magazine". */
export const roMarket = (n: number): string => roForm(n, 'magazin', 'magazine')

// SEHIR de sayiya gore cekimleniyor. Bu, Lehce'den miras kalan bir eksikti:
// sablonlarda "{cities} miast" sabit yaziliydi ve 2-4 icin YANLIS ("2 miasta"
// olmali). Hirvatca'da ayni hata "2 gradova" (dogrusu "2 grada"), Romence'de
// ise 20+ icin eksik "de" olarak gorunuyordu -- ve Romanya'da kapsanan sehir
// sayisinin 20'yi gecmesi gayet olasi.
/** Lehce "N miasto/miasta/miast". */
export const plSehir = (n: number): string => plForm(n, 'miasto', 'miasta', 'miast')

/** Hirvatca "N grad/grada/gradova". */
export const hrSehir = (n: number): string => hrForm(n, 'grad', 'grada', 'gradova')

/** Romence "N oras/orase/de orase". */
export const roSehir = (n: number): string => roForm(n, 'oraș', 'orașe')

/**
 * Locale-farkinda doldurucu.
 *
 * Lehce sablonlarda sayidan sonra gelen isim, sayiya gore cekimlenmek zorunda.
 * `fill` bunu bilemez; bu sarmalayici PL icin `{produkty}` ve `{sklepy}`
 * degiskenlerini sayilardan TURETIP ekliyor, boylece sablonlar okunakli
 * kaliyor ve cagrilan yerlerin cogu degismiyor.
 *
 * TR icin hicbir sey yapmaz (Turkcede sayidan sonra cogul eki gelmez).
 */
export function fillLocalized(
  locale: Locale,
  template: string,
  vars: Record<string, string | number>,
): string {
  // TR ve HU'da sayidan sonra isim CEKIMLENMEZ (Turkce "2 urun", Macarca
  // "2 termek") -- ikisinde de duz doldurma dogru.
  if (locale !== 'pl' && locale !== 'hr' && locale !== 'ro') return fill(template, vars)
  const sayi = (k: string): number | null => {
    const v = vars[k]
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      // "2.877" gibi bicimlenmis sayilardan da cikarabilmeli.
      const n = Number(v.replace(/[^0-9-]/g, ''))
      return Number.isFinite(n) ? n : null
    }
    return null
  }
  const ek: Record<string, string | number> = { ...vars }
  const urunSayisi = sayi('count') ?? sayi('products')
  const marketSayisi = sayi('stores') ?? sayi('branches')
  // Her dil KENDI degisken adini kullanir; sablon yalnizca kendi dilindekini
  // icerdigi icin digerleri sessizce kullanilmadan kalir.
  const sehirSayisi = sayi('cities')
  if (locale === 'pl') {
    if (urunSayisi !== null) ek.produkty = plUrun(urunSayisi)
    if (marketSayisi !== null) ek.sklepy = plMarket(marketSayisi)
    if (sehirSayisi !== null) ek.miasta = plSehir(sehirSayisi)
  } else if (locale === 'hr') {
    if (urunSayisi !== null) ek.proizvodi = hrUrun(urunSayisi)
    if (marketSayisi !== null) ek.trgovine = hrMarket(marketSayisi)
    if (sehirSayisi !== null) ek.gradovi = hrSehir(sehirSayisi)
  } else if (locale === 'ro') {
    if (urunSayisi !== null) ek.produse = roUrun(urunSayisi)
    if (marketSayisi !== null) ek.magazine = roMarket(marketSayisi)
    if (sehirSayisi !== null) ek.orase = roSehir(sehirSayisi)
  }
  return fill(template, ek)
}

const tr: ContentDict = {
  breadcrumbHome: 'Ana sayfa',

  product: {
    priceTableCaption: 'Marketlere göre güncel fiyatlar',
    store: 'Market',
    price: 'Fiyat',
    updated: 'Güncelleme',
    cheapest: 'En ucuz',
    savingHeadline: '{store} en ucuzu — en pahalıdan {pct} düşük, {abs} fark',
    savingNone: '{count} markette aynı fiyat',
    availability: '{count} markette bulunuyor',
    trend: 'Son 28 gün',
    trendLabel: '{name} ürününün son 28 gündeki en düşük fiyat seyri',
    similar: 'Aynı kategoriden',
    faqTitle: 'Sık sorulanlar',
    q1: '{name} en ucuz hangi markette?',
    a1: 'Şu an en ucuz {store}: {price}. Fiyat {date} güncellendi.',
    q2: '{name} fiyatları marketlere göre ne kadar değişiyor?',
    a2: 'En ucuz {min}, en pahalı {max}. Aradaki fark {abs} — yani doğru markete giderek {pct} tasarruf edebilirsin.',
    cta: 'Her üründe bu farkı gör',
    ctaBody:
      'Cheep alışveriş listeni tüm marketlerde karşılaştırır ve sepetini en ucuz markete taşır. Ücretsiz.',
    from: 'En düşük',
    stores: 'markette',
    save: 'Kazanç',
    noOffers: 'Bu ürün için şu an fiyat bilgisi yok.',
  },

  category: {
    intro:
      '{name} kategorisinde {count} ürünün fiyatını {stores} markette karşılaştırdık. En ucuz seçenekler aşağıda.',
    introSingle: '{name} kategorisinde {count} ürün karşılaştırılıyor.',
    byStore: 'Markete göre {name}',
    empty: 'Bu kategoride henüz karşılaştırılabilir ürün yok.',
  },

  storeCategory: {
    intro: '{store} mağazasında {name} kategorisindeki {count} ürünün fiyatı, diğer marketlerle karşılaştırmalı olarak listeleniyor.',
  },

  store: {
    intro:
      '{name} fiyatlarını diğer marketlerle karşılaştır. {products} ürün, {branches} şube, {cities} şehir.',
    branches: 'şube',
    cities: 'şehir',
    products: 'ürün',
    categories: 'Kategoriler',
    topDrops: 'Bu hafta ucuzlayanlar',
  },

  city: {
    intro: "{name} şehrinde {branches} market şubesi var. Hangi zincirin nerede olduğunu ve fiyatları karşılaştır.",
    branches: 'şube',
    stores: 'market zinciri',
    chains: 'Şehirdeki zincirler',
  },

  report: {
    title: 'Zam raporu',
    lead: 'Son 28 günde en çok zamlanan ve en çok ucuzlayan ürünler. Her gece otomatik güncellenir.',
    risers: 'En çok zamlananlar',
    fallers: 'En çok ucuzlayanlar',
    noData: 'Rapor için yeterli fiyat geçmişi henüz birikmedi.',
    change: 'Değişim',
  },

  compare: {
    title: 'En ucuz market hangisi?',
    lead: 'Marketleri ürün sayısı, şube ağı ve kaç üründe en ucuz olduklarına göre karşılaştır.',
    table: 'Marketlerin karşılaştırması',
    store: 'Market',
    products: 'Ürün',
    branches: 'Şube',
    cheapestCount: 'En ucuz olduğu ürün',
  },

  products: {
    title: 'Ürünler',
    lead: '{products} ürünü {stores} markette karşılaştır. Kategoriye, markete ve fiyata göre filtrele.',
    navLabel: 'Ürünler',
    searchPlaceholder: 'Ürün veya marka ara…',
    allCategories: 'Tüm kategoriler',
    filters: 'Filtreler',
    stores: 'Marketler',
    sort: 'Sırala',
    sortRelevance: 'Önerilen',
    sortPriceAsc: 'En düşük fiyat',
    sortPriceDesc: 'En yüksek fiyat',
    sortSavings: 'En çok tasarruf',
    sortName: 'İsme göre',
    priceRange: 'Fiyat aralığı',
    priceMin: 'En az',
    priceMax: 'En çok',
    resultCount: '{count} ürün',
    empty: 'Bu filtrelerle ürün bulunamadı.',
    clearFilters: 'Filtreleri temizle',
    error: 'Ürünler yüklenemedi.',
    retry: 'Tekrar dene',
    loading: 'Yükleniyor…',
    apply: 'Uygula',
    close: 'Kapat',
    directoryTitle: 'Tüm kategoriler, marketler ve şehirler',
  },

  browse: {
    title: 'Market fiyatları',
    lead: '{products} ürünün fiyatını {stores} markette ve {branches} şubede karşılaştırıyoruz. Kategoriye, markete veya şehre göre gez.',
    categories: 'Kategoriler',
    stores: 'Marketler',
    cities: 'Şehirler',
    navLabel: 'Fiyatlar',
  },

  pagination: {
    nav: 'Sayfalar',
    prev: 'Önceki',
    next: 'Sonraki',
    page: 'Sayfa',
  },
}

const pl: ContentDict = {
  breadcrumbHome: 'Strona główna',

  product: {
    priceTableCaption: 'Aktualne ceny w sklepach',
    store: 'Sklep',
    price: 'Cena',
    updated: 'Aktualizacja',
    cheapest: 'Najtaniej',
    savingHeadline: 'Najtaniej w {store} — {pct} mniej niż najdrożej, różnica {abs}',
    savingNone: 'Ta sama cena w {count} sklepach',
    availability: 'Dostępny w {count} sklepach',
    trend: 'Ostatnie 28 dni',
    trendLabel: 'Najniższa cena produktu {name} w ciągu ostatnich 28 dni',
    similar: 'Z tej samej kategorii',
    faqTitle: 'Często zadawane pytania',
    q1: 'Gdzie {name} jest najtańszy?',
    a1: 'Obecnie najtaniej w {store}: {price}. Cena zaktualizowana {date}.',
    q2: 'Jak bardzo różnią się ceny produktu {name}?',
    a2: 'Najtaniej {min}, najdrożej {max}. Różnica to {abs} — wybierając właściwy sklep oszczędzasz {pct}.',
    cta: 'Zobacz tę różnicę przy każdym produkcie',
    ctaBody:
      'Cheep porównuje Twoją listę zakupów we wszystkich sklepach i przenosi koszyk do najtańszego. Za darmo.',
    from: 'Od',
    stores: 'sklepach',
    save: 'Oszczędność',
    noOffers: 'Brak danych o cenach tego produktu.',
  },

  category: {
    intro:
      'Porównaliśmy ceny {count} {produkty} z kategorii {name} w {stores} {sklepy}. Najtańsze opcje poniżej.',
    introSingle: 'W kategorii {name} porównujemy {count} {produkty}.',
    byStore: '{name} według sklepu',
    empty: 'W tej kategorii nie ma jeszcze produktów do porównania.',
  },

  storeCategory: {
    intro: 'Ceny {count} {produkty} z kategorii {name} w sklepie {store}, porównane z innymi sieciami.',
  },

  store: {
    intro:
      'Porównaj ceny w {name} z innymi sklepami. {products} {produkty}, {branches} {sklepy}, {cities} {miasta}.',
    branches: 'sklepów',
    cities: 'miast',
    products: 'produktów',
    categories: 'Kategorie',
    topDrops: 'Przecenione w tym tygodniu',
  },

  city: {
    intro: 'W mieście {name} jest {branches} {sklepy}. Sprawdź, które sieci działają w okolicy i porównaj ceny.',
    branches: 'sklepów',
    stores: 'sieci handlowych',
    chains: 'Sieci w mieście',
  },

  report: {
    title: 'Raport cen',
    lead: 'Produkty, które najbardziej podrożały i staniały w ciągu 28 dni. Aktualizowany każdej nocy.',
    risers: 'Największe podwyżki',
    fallers: 'Największe obniżki',
    noData: 'Za mało historii cen, aby przygotować raport.',
    change: 'Zmiana',
  },

  compare: {
    title: 'Który sklep jest najtańszy?',
    lead: 'Porównaj sklepy według liczby produktów, sieci placówek i tego, jak często są najtańsze.',
    table: 'Porównanie sklepów',
    store: 'Sklep',
    products: 'Produkty',
    branches: 'Sklepy',
    cheapestCount: 'Najtańszy w produktach',
  },

  products: {
    title: 'Produkty',
    lead: 'Porównaj {products} produktów w {stores} sieciach. Filtruj według kategorii, sklepu i ceny.',
    navLabel: 'Produkty',
    searchPlaceholder: 'Szukaj produktu lub marki…',
    allCategories: 'Wszystkie kategorie',
    filters: 'Filtry',
    stores: 'Sklepy',
    sort: 'Sortuj',
    sortRelevance: 'Polecane',
    sortPriceAsc: 'Najniższa cena',
    sortPriceDesc: 'Najwyższa cena',
    sortSavings: 'Największa oszczędność',
    sortName: 'Według nazwy',
    priceRange: 'Zakres cen',
    priceMin: 'Od',
    priceMax: 'Do',
    resultCount: '{count} produktów',
    empty: 'Brak produktów dla tych filtrów.',
    clearFilters: 'Wyczyść filtry',
    error: 'Nie udało się wczytać produktów.',
    retry: 'Spróbuj ponownie',
    loading: 'Ładowanie…',
    apply: 'Zastosuj',
    close: 'Zamknij',
    directoryTitle: 'Wszystkie kategorie, sklepy i miasta',
  },

  browse: {
    title: 'Ceny w sklepach',
    lead: 'Porównujemy ceny {products} produktów w {stores} sieciach i {branches} sklepach. Przeglądaj według kategorii, sklepu lub miasta.',
    categories: 'Kategorie',
    stores: 'Sklepy',
    cities: 'Miasta',
    navLabel: 'Ceny',
  },

  pagination: {
    nav: 'Strony',
    prev: 'Poprzednia',
    next: 'Następna',
    page: 'Strona',
  },
}


/**
 * Hirvatca.
 *
 * Sayidan sonra gelen isim `fillLocalized` ile {proizvodi}/{trgovine}
 * degiskenlerinden doldurulur -- Lehce'deki {produkty}/{sklepy} ile ayni yer.
 */
const hr: ContentDict = {
  breadcrumbHome: 'Početna',

  product: {
    priceTableCaption: 'Aktualne cijene po trgovinama',
    store: 'Trgovina',
    price: 'Cijena',
    updated: 'Ažurirano',
    cheapest: 'Najjeftinije',
    savingHeadline: 'Najjeftinije u {store} — {pct} niže od najskuplje cijene, razlika {abs}',
    savingNone: 'Ista cijena u svim trgovinama ({count})',
    availability: 'Dostupno u trgovinama: {count}',
    trend: 'Zadnjih 28 dana',
    trendLabel: 'Kretanje najniže cijene proizvoda {name} u zadnjih 28 dana',
    similar: 'Iz iste kategorije',
    faqTitle: 'Često postavljana pitanja',
    q1: 'Gdje je {name} najjeftiniji?',
    a1: 'Trenutačno je najjeftiniji u {store}: {price}. Cijena je ažurirana {date}.',
    q2: 'Koliko se cijene proizvoda {name} razlikuju po trgovinama?',
    a2: 'Najniža je {min}, najviša {max}. Razlika je {abs} — odabirom prave trgovine uštediš {pct}.',
    cta: 'Vidi ovu razliku na svakom proizvodu',
    ctaBody:
      'Cheep uspoređuje tvoj popis za kupnju u svim trgovinama i premješta košaricu u najjeftiniju. Besplatno.',
    from: 'Od',
    stores: 'trgovina',
    save: 'Ušteda',
    noOffers: 'Za ovaj proizvod trenutačno nema podataka o cijeni.',
  },

  category: {
    intro:
      'Usporedili smo cijene {count} {proizvodi} iz kategorije {name} u {stores} {trgovine}. Najjeftinije opcije nalaze se u nastavku.',
    introSingle: 'U kategoriji {name} uspoređujemo {count} {proizvodi}.',
    byStore: '{name} po trgovinama',
    empty: 'U ovoj kategoriji još nema proizvoda za usporedbu.',
  },

  storeCategory: {
    intro: 'Cijene {count} {proizvodi} iz kategorije {name} u trgovini {store}, uspoređene s ostalim lancima.',
  },

  store: {
    intro:
      'Usporedi cijene lanca {name} s ostalim trgovinama. {products} {proizvodi}, {branches} {trgovine}, {cities} {gradovi}.',
    branches: 'trgovina',
    cities: 'gradova',
    products: 'proizvoda',
    categories: 'Kategorije',
    topDrops: 'Sniženo ovaj tjedan',
  },

  city: {
    intro: 'U gradu {name} ima {branches} {trgovine}. Provjeri koji lanci posluju u blizini i usporedi cijene.',
    branches: 'trgovina',
    stores: 'trgovačkih lanaca',
    chains: 'Lanci u gradu',
  },

  report: {
    title: 'Izvješće o cijenama',
    lead: 'Proizvodi koji su u zadnjih 28 dana najviše poskupjeli i najviše pojeftinili. Ažurira se svake noći.',
    risers: 'Najveća poskupljenja',
    fallers: 'Najveća pojeftinjenja',
    noData: 'Još nema dovoljno povijesti cijena za izvješće.',
    change: 'Promjena',
  },

  compare: {
    title: 'Koja je trgovina najjeftinija?',
    lead: 'Usporedi trgovine po broju proizvoda, mreži poslovnica i tome koliko su često najjeftinije.',
    table: 'Usporedba trgovina',
    store: 'Trgovina',
    products: 'Proizvodi',
    branches: 'Poslovnice',
    cheapestCount: 'Proizvodi s najnižom cijenom',
  },

  products: {
    title: 'Proizvodi',
    lead: 'Usporedi {products} proizvoda u {stores} trgovina. Filtriraj po kategoriji, trgovini i cijeni.',
    navLabel: 'Proizvodi',
    searchPlaceholder: 'Traži proizvod ili marku…',
    allCategories: 'Sve kategorije',
    filters: 'Filtri',
    stores: 'Trgovine',
    sort: 'Sortiraj',
    sortRelevance: 'Preporučeno',
    sortPriceAsc: 'Najniža cijena',
    sortPriceDesc: 'Najviša cijena',
    sortSavings: 'Najveća ušteda',
    sortName: 'Po nazivu',
    priceRange: 'Raspon cijena',
    priceMin: 'Od',
    priceMax: 'Do',
    resultCount: '{count} proizvoda',
    empty: 'Nema proizvoda za odabrane filtre.',
    clearFilters: 'Očisti filtre',
    error: 'Proizvode nije bilo moguće učitati.',
    retry: 'Pokušaj ponovno',
    loading: 'Učitavanje…',
    apply: 'Primijeni',
    close: 'Zatvori',
    directoryTitle: 'Sve kategorije, trgovine i gradovi',
  },

  browse: {
    title: 'Cijene u trgovinama',
    lead: 'Uspoređujemo cijene {products} proizvoda u {stores} trgovina i {branches} poslovnica. Pregledavaj po kategoriji, trgovini ili gradu.',
    categories: 'Kategorije',
    stores: 'Trgovine',
    cities: 'Gradovi',
    navLabel: 'Cijene',
  },

  pagination: {
    nav: 'Stranice',
    prev: 'Prethodna',
    next: 'Sljedeća',
    page: 'Stranica',
  },
}

/**
 * Macarca.
 *
 * Macarcada sayidan sonra isim COGULLASMAZ ("2 termek", "2 termekek" DEGIL);
 * bu yuzden burada hicbir cekim degiskeni kullanilmaz, isim tekil yazilir.
 */
const hu: ContentDict = {
  breadcrumbHome: 'Főoldal',

  product: {
    priceTableCaption: 'Aktuális árak boltonként',
    store: 'Bolt',
    price: 'Ár',
    updated: 'Frissítve',
    cheapest: 'Legolcsóbb',
    savingHeadline: 'Legolcsóbb: {store} — {pct}-kal olcsóbb a legdrágábbnál, {abs} a különbség',
    savingNone: 'Ugyanaz az ár {count} boltban',
    availability: '{count} boltban kapható',
    trend: 'Az elmúlt 28 nap',
    trendLabel: 'A(z) {name} legalacsonyabb árának alakulása az elmúlt 28 napban',
    similar: 'Ugyanebből a kategóriából',
    faqTitle: 'Gyakori kérdések',
    q1: 'Melyik boltban a legolcsóbb a(z) {name}?',
    a1: 'Jelenleg a(z) {store} boltban a legolcsóbb: {price}. Ár frissítve: {date}.',
    q2: 'Mennyire térnek el a(z) {name} árai boltonként?',
    a2: 'A legolcsóbb {min}, a legdrágább {max}. A különbség {abs} — a megfelelő boltot választva {pct}-ot spórolhatsz.',
    cta: 'Lásd ezt a különbséget minden terméknél',
    ctaBody:
      'A Cheep az összes boltban összehasonlítja a bevásárlólistádat, és a kosaradat a legolcsóbb boltba viszi. Ingyenes.',
    from: 'Legolcsóbb ár',
    stores: 'boltban',
    save: 'Megtakarítás',
    noOffers: 'Ehhez a termékhez jelenleg nincs árinformáció.',
  },

  category: {
    intro:
      'A(z) {name} kategóriában {count} termék árát hasonlítottuk össze {stores} boltban. A legolcsóbb ajánlatok alább.',
    introSingle: 'A(z) {name} kategóriában {count} terméket hasonlítunk össze.',
    byStore: '{name} boltok szerint',
    empty: 'Ebben a kategóriában még nincs összehasonlítható termék.',
  },

  storeCategory: {
    intro: 'A(z) {store} {name} kategóriájában {count} termék ára, a többi bolttal összehasonlítva.',
  },

  store: {
    intro:
      'Hasonlítsd össze a(z) {name} árait a többi bolttal. {products} termék, {branches} üzlet, {cities} város.',
    branches: 'üzlet',
    cities: 'város',
    products: 'termék',
    categories: 'Kategóriák',
    topDrops: 'Ezen a héten olcsóbb lett',
  },

  city: {
    intro: '{name} városában {branches} bolt található. Nézd meg, melyik lánc hol van, és hasonlítsd össze az árakat.',
    branches: 'üzlet',
    stores: 'üzletlánc',
    chains: 'Láncok a városban',
  },

  report: {
    title: 'Árjelentés',
    lead: 'Az elmúlt 28 nap legnagyobb drágulásai és árcsökkenései. Minden éjjel automatikusan frissül.',
    risers: 'Legnagyobb drágulások',
    fallers: 'Legnagyobb árcsökkenések',
    noData: 'Még nincs elég ártörténet a jelentéshez.',
    change: 'Változás',
  },

  compare: {
    title: 'Melyik bolt a legolcsóbb?',
    lead: 'Hasonlítsd össze a boltokat termékszám, üzlethálózat és aszerint, hány terméknél ők a legolcsóbbak.',
    table: 'Boltok összehasonlítása',
    store: 'Bolt',
    products: 'Termék',
    branches: 'Üzlet',
    cheapestCount: 'Ennyi terméknél a legolcsóbb',
  },

  products: {
    title: 'Termékek',
    lead: 'Hasonlíts össze {products} terméket {stores} boltban. Szűrj kategória, bolt és ár szerint.',
    navLabel: 'Termékek',
    searchPlaceholder: 'Termék vagy márka keresése…',
    allCategories: 'Minden kategória',
    filters: 'Szűrők',
    stores: 'Boltok',
    sort: 'Rendezés',
    sortRelevance: 'Ajánlott',
    sortPriceAsc: 'Legalacsonyabb ár',
    sortPriceDesc: 'Legmagasabb ár',
    sortSavings: 'Legnagyobb megtakarítás',
    sortName: 'Név szerint',
    priceRange: 'Ártartomány',
    priceMin: 'Min.',
    priceMax: 'Max.',
    resultCount: '{count} termék',
    empty: 'Ezekkel a szűrőkkel nem található termék.',
    clearFilters: 'Szűrők törlése',
    error: 'A termékeket nem sikerült betölteni.',
    retry: 'Próbáld újra',
    loading: 'Betöltés…',
    apply: 'Alkalmaz',
    close: 'Bezárás',
    directoryTitle: 'Minden kategória, bolt és város',
  },

  browse: {
    title: 'Bolti árak',
    lead: '{products} termék árát hasonlítjuk össze {stores} boltláncnál és {branches} üzletben. Böngéssz kategória, bolt vagy város szerint.',
    categories: 'Kategóriák',
    stores: 'Boltok',
    cities: 'Városok',
    navLabel: 'Árak',
  },

  pagination: {
    nav: 'Oldalak',
    prev: 'Előző',
    next: 'Következő',
    page: 'Oldal',
  },
}

/**
 * Romence.
 *
 * Sayidan sonra gelen isim `fillLocalized` ile {produse}/{magazine}
 * degiskenlerinden doldurulur; `roForm` 20 ve uzeri sayilarda "de" edatini
 * kendisi ekler ("20 de produse").
 */
const ro: ContentDict = {
  breadcrumbHome: 'Pagina principală',

  product: {
    priceTableCaption: 'Prețuri actuale pe magazine',
    store: 'Magazin',
    price: 'Preț',
    updated: 'Actualizat',
    cheapest: 'Cel mai ieftin',
    savingHeadline: 'Cel mai ieftin la {store} — cu {pct} mai puțin decât cel mai scump, diferență de {abs}',
    savingNone: 'Același preț în toate magazinele ({count})',
    availability: 'Disponibil în {count} magazine',
    trend: 'Ultimele 28 de zile',
    trendLabel: 'Evoluția celui mai mic preț pentru {name} în ultimele 28 de zile',
    similar: 'Din aceeași categorie',
    faqTitle: 'Întrebări frecvente',
    q1: 'Unde este {name} cel mai ieftin?',
    a1: 'Momentan cel mai ieftin este la {store}: {price}. Preț actualizat pe {date}.',
    q2: 'Cât de mult diferă prețurile pentru {name} de la un magazin la altul?',
    a2: 'Cel mai mic preț este {min}, cel mai mare {max}. Diferența este {abs} — alegând magazinul potrivit economisești {pct}.',
    cta: 'Vezi această diferență la fiecare produs',
    ctaBody:
      'Cheep îți compară lista de cumpărături în toate magazinele și îți mută coșul la cel mai ieftin. Gratuit.',
    from: 'De la',
    stores: 'magazine',
    save: 'Economie',
    noOffers: 'Momentan nu avem informații de preț pentru acest produs.',
  },

  category: {
    intro:
      'Am comparat prețurile a {count} {produse} din categoria {name} în {stores} {magazine}. Cele mai ieftine opțiuni sunt mai jos.',
    introSingle: 'În categoria {name} comparăm {count} {produse}.',
    byStore: '{name} pe magazine',
    empty: 'În această categorie încă nu există produse de comparat.',
  },

  storeCategory: {
    intro: 'Prețurile a {count} {produse} din categoria {name} la {store}, comparate cu celelalte lanțuri.',
  },

  store: {
    intro:
      'Compară prețurile {name} cu ale celorlalte magazine. {products} {produse}, {branches} {magazine}, {cities} {orase}.',
    branches: 'magazine',
    cities: 'orașe',
    products: 'produse',
    categories: 'Categorii',
    topDrops: 'S-au ieftinit săptămâna aceasta',
  },

  city: {
    intro: 'În orașul {name} găsești {branches} {magazine}. Vezi ce lanțuri sunt în zonă și compară prețurile.',
    branches: 'magazine',
    stores: 'lanțuri de magazine',
    chains: 'Lanțuri din oraș',
  },

  report: {
    title: 'Raport de prețuri',
    lead: 'Produsele care s-au scumpit și s-au ieftinit cel mai mult în ultimele 28 de zile. Se actualizează în fiecare noapte.',
    risers: 'Cele mai mari scumpiri',
    fallers: 'Cele mai mari ieftiniri',
    noData: 'Încă nu există suficient istoric de prețuri pentru raport.',
    change: 'Variație',
  },

  compare: {
    title: 'Care magazin este cel mai ieftin?',
    lead: 'Compară magazinele după numărul de produse, rețeaua de unități și cât de des au cel mai mic preț.',
    table: 'Comparație între magazine',
    store: 'Magazin',
    products: 'Produse',
    branches: 'Unități',
    cheapestCount: 'Produse la cel mai mic preț',
  },

  products: {
    title: 'Produse',
    lead: 'Compară {products} de produse din {stores} magazine. Filtrează după categorie, magazin și preț.',
    navLabel: 'Produse',
    searchPlaceholder: 'Caută un produs sau o marcă…',
    allCategories: 'Toate categoriile',
    filters: 'Filtre',
    stores: 'Magazine',
    sort: 'Sortează',
    sortRelevance: 'Recomandate',
    sortPriceAsc: 'Cel mai mic preț',
    sortPriceDesc: 'Cel mai mare preț',
    sortSavings: 'Cea mai mare economie',
    sortName: 'După nume',
    priceRange: 'Interval de preț',
    priceMin: 'Min.',
    priceMax: 'Max.',
    resultCount: 'Rezultate: {count}',
    empty: 'Niciun produs pentru aceste filtre.',
    clearFilters: 'Șterge filtrele',
    error: 'Produsele nu au putut fi încărcate.',
    retry: 'Încearcă din nou',
    loading: 'Se încarcă…',
    apply: 'Aplică',
    close: 'Închide',
    directoryTitle: 'Toate categoriile, magazinele și orașele',
  },

  browse: {
    title: 'Prețuri din magazine',
    lead: 'Comparăm prețurile a {products} de produse în {stores} magazine și {branches} de unități. Navighează după categorie, magazin sau oraș.',
    categories: 'Categorii',
    stores: 'Magazine',
    cities: 'Orașe',
    navLabel: 'Prețuri',
  },

  pagination: {
    nav: 'Pagini',
    prev: 'Anterioara',
    next: 'Următoarea',
    page: 'Pagina',
  },
}

export const CONTENT: Record<Locale, ContentDict> = { tr, pl, hr, hu, ro }
