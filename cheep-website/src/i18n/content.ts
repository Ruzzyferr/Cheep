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
  locale: 'tr' | 'pl',
  template: string,
  vars: Record<string, string | number>,
): string {
  if (locale !== 'pl') return fill(template, vars)
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
  if (urunSayisi !== null) ek.produkty = plUrun(urunSayisi)
  const marketSayisi = sayi('stores') ?? sayi('branches')
  if (marketSayisi !== null) ek.sklepy = plMarket(marketSayisi)
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
      'Porównaj ceny w {name} z innymi sklepami. {products} {produkty}, {branches} {sklepy}, {cities} miast.',
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

export const CONTENT: Record<Locale, ContentDict> = { tr, pl }
