/**
 * Çeviri sözlüğünün şekli. `tr.ts` referans, `pl.ts` bu tiple derlenir —
 * eksik veya fazla bir anahtar derleme hatası verir.
 */

/** Uzun metin blokları. Satır içi biçim: `**kalın**` ve `[etiket](href)`. */
export type Block =
  | { h2: string }
  | { h3: string }
  | { p: string }
  | { ul: string[] }

export type TickerRow = {
  product: string
  /** İlk fiyat en pahalı, sonuncusu en ucuz olacak şekilde sırala. */
  prices: string[]
}

export type Dict = {
  /** <html lang> ve Intl biçimlendirmesi için BCP-47 etiketi. */
  htmlLang: string
  /** og:locale */
  ogLocale: string

  /** Gerçek 404 sayfasının metinleri (prerender üretiyor, uygulama değil). */
  notFound: {
    title: string
    description: string
  }

  nav: {
    links: { label: string; href: string }[]
    download: string
    openMenu: string
    closeMenu: string
    home: string
    /**
     * Dil menüsünün erişilebilirlik etiketi ("Dil seç" / "Odaberi jezik").
     *
     * ESKİDEN farklı bir şeydi: DİĞER dilin kendi adını tutuyordu ('Polski')
     * çünkü site iki dilliydi ve "diğer dil" tek ve belirliydi. Beş dille bu
     * model çöktü — dillerin kendi adları artık dilden bağımsız tek bir
     * tabloda (`i18n/index.ts` → LOCALE_NATIVE_NAMES), bu anahtar da menünün
     * etiketi oldu.
     */
    langMenuLabel: string
  }

  hero: {
    badge: string
    titleLine1: string
    titleLine2: string
    sub: string
    ctaPrimary: string
    ctaSecondary: string
    ticker: TickerRow[]
    tagCheapest: string
    tagSaving: string
  }

  compare: {
    eyebrow: string
    titleLead: string
    titleAccent: string
    body: string
    sourceNote: string
    card: {
      name: string
      unit: string
      emoji: string
      rows: { store: string; price: string; cheapest?: boolean; color: string }[]
      cheapestBadge: string
      savingLabel: string
      savingValue: string
    }
  }

  how: {
    eyebrow: string
    title: string
    sub: string
    steps: { n: string; title: string; body: string }[]
  }

  savings: {
    eyebrow: string
    titleLead: string
    titleAccentSuffix: string
    sub: string
    stats: { key: 'products' | 'branches' | 'countries' | 'updates'; label: string }[]
    updatesValue: string
  }

  coverage: {
    eyebrow: string
    titleLead: string
    titleAccent: string
    sub: string
    countries: { code: 'TR' | 'PL' | 'HR' | 'HU' | 'RO' | 'DE' | 'CH' | 'SE'; name: string }[]
    branchesUnit: string
    live: string
    soon: string
  }

  features: {
    eyebrow: string
    title: string
    sub: string
    items: { emoji: string; title: string; body: string }[]
  }

  faq: {
    eyebrow: string
    title: string
    sub: string
    items: { q: string; a: string }[]
  }

  download: {
    titleLead: string
    titleAccent: string
    sub: string
    /** Resmi Play rozeti bir görsel — alt metni burada. */
    playAlt: string
    storeTop: string
    storeBottom: string
    note: string
  }

  footer: {
    tagline: string
    cols: { title: string; links: { label: string; href: string }[] }[]
    disclaimer: string
    copyright: string
    madeIn: string
  }

  legal: {
    eyebrow: string
    updatedPrefix: string
    backHome: string
    privacy: { title: string; updated: string; blocks: Block[] }
    terms: { title: string; updated: string; blocks: Block[] }
    del: {
      title: string
      updated: string
      intro: Block[]
      emailLabel: string
      emailPlaceholder: string
      passwordLabel: string
      confirmLabel: string
      submit: string
      submitting: string
      deletedTitle: string
      successFallback: string
      errorFallback: string
      networkError: string
      help: Block[]
    }
  }

  seo: {
    home: { title: string; description: string }
    privacy: { title: string; description: string }
    terms: { title: string; description: string }
    del: { title: string; description: string }
    /** JSON-LD SoftwareApplication açıklaması. */
    appDescription: string
  }
}
