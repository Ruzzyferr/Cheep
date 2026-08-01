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
    a1: 'Şu an en ucuz {store}: {price}. Fiyat {date} tarihinde güncellendi.',
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
      'Porównaliśmy ceny {count} produktów z kategorii {name} w {stores} sklepach. Najtańsze opcje poniżej.',
    introSingle: 'W kategorii {name} porównujemy {count} produktów.',
    byStore: '{name} według sklepu',
    empty: 'W tej kategorii nie ma jeszcze produktów do porównania.',
  },

  store: {
    intro:
      'Porównaj ceny w {name} z innymi sklepami. {products} produktów, {branches} sklepów, {cities} miast.',
    branches: 'sklepów',
    cities: 'miast',
    products: 'produktów',
    categories: 'Kategorie',
    topDrops: 'Przecenione w tym tygodniu',
  },

  city: {
    intro: 'W mieście {name} jest {branches} sklepów. Sprawdź, które sieci działają w okolicy i porównaj ceny.',
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
