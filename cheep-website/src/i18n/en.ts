import type { Dict } from './types'

/**
 * İngilizce sözlük.
 *
 * NEDEN VAR: App Store'un `en-US` listelemesi geliştirici sitesi olarak
 * cheep.live'ı gösteriyor. İngilizce konuşan ziyaretçi oraya tıkladığında
 * Türkçe bir sayfaya düşüyordu — mağazada İngilizce metin okuyup sitede
 * Türkçe görmek güven kıran bir sıçrama.
 *
 * İNGİLİZCE BİR PAZAR DEĞİL, BİR YEDEK. Bu yüzden `COUNTRY_LOCALE` içinde
 * karşılığı YOK: ürün ve kategori sayfaları üretilmiyor. Üretseydik 5.800
 * sayfanın Türkçe kataloğunu ikinci kez, başka bir adreste yayınlamış
 * olurduk — Google'ın gözünde mükerrer içerik, üstelik hiçbir İngilizce
 * arama hacmi karşılığı olmadan. İngilizce yalnızca tanıtım ve yasal
 * sayfaları kapsıyor; anasayfa TR verisini gösteriyor (mağazadaki İngilizce
 * ekran görüntüleri de aynı şeyi yapıyor).
 */
export const en: Dict = {
  htmlLang: 'en',
  ogLocale: 'en_US',

  notFound: {
    title: 'Page not found — Cheep',
    description: 'The page you are looking for could not be found.',
  },

  nav: {
    links: [
      { label: 'Products', href: '/products' },
      { label: 'How it works', href: '#how' },
      { label: 'Savings', href: '#savings' },
      { label: 'Countries', href: '#coverage' },
      { label: 'Features', href: '#features' },
      { label: 'FAQ', href: '#faq' },
    ],
    download: 'Download',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    home: 'Cheep home',
    langMenuLabel: 'Choose language',
  },

  hero: {
    badge: 'Live in 5 countries · 120,000+ products',
    titleLine1: 'Same product.',
    titleLine2: 'Cheapest price.',
    sub: 'Cheep compares supermarket prices item by item and moves your shopping list to the cheapest basket. Real prices, updated every day — save without thinking about it.',
    ctaPrimary: 'Download the app',
    ctaSecondary: 'How it works',
    // Fiyatlar örnektir ve TR kataloğundan; İngilizce anasayfa da TR verisini
    // gösteriyor, örneklerin para birimi onunla tutarlı olmalı.
    ticker: [
      { product: 'Milk 1L', prices: ['Migros ₺31.00', 'A101 ₺28.50', 'ŞOK ₺27.90'] },
      { product: 'Eggs, 10 pack', prices: ['CarrefourSA ₺59.00', 'A101 ₺57.50', 'BİM ₺54.90'] },
      { product: 'Olive oil 1L', prices: ['Migros ₺319', 'A101 ₺299', 'ŞOK ₺289'] },
      { product: 'Bread', prices: ['A101 ₺8.00', 'BİM ₺7.90', 'Halk ₺7.50'] },
      { product: 'Tea 1kg', prices: ['Migros ₺214', 'ŞOK ₺199', 'BİM ₺189'] },
    ],
    tagCheapestPrice: '₺27.90',
    tagCheapest: '✓ cheapest',
    tagSaving: '18% saved',
  },

  compare: {
    eyebrow: 'Official data · updated daily',
    titleLead: 'Same product,',
    titleAccent: 'a different price in every store.',
    body: 'On a single carton of milk you can pay 10–15% more from one chain to the next. Cheep puts the price of that exact product side by side across chains and hands you the cheapest one in a second — no guessing, no driving around.',
    sourceNote: 'Official and public sources · updated daily',
    card: {
      name: 'Whole Milk',
      unit: '1 L · same brand, same product',
      emoji: '🥛',
      rows: [
        { store: 'Migros', price: '₺31.00', color: '#FF7A00' },
        { store: 'A101', price: '₺28.50', color: '#00507D' },
        { store: 'BİM', price: '₺29.40', color: '#6B8E7F' },
        { store: 'ŞOK', price: '₺27.90', cheapest: true, color: '#E31E24' },
      ],
      cheapestBadge: 'Cheapest',
      savingLabel: 'You save on this item',
      savingValue: '₺3.10 · 10%',
    },
  },

  how: {
    eyebrow: 'How it works',
    title: 'Save in three steps',
    sub: 'Nothing complicated. Give Cheep your list and let it do the rest.',
    steps: [
      {
        n: '01',
        title: 'Build your list',
        body: 'Type what you need or search for products. Milk, eggs, detergent — add whatever is on your list.',
      },
      {
        n: '02',
        title: 'Cheep compares',
        body: 'It matches every item by barcode and scans current prices across all the chains. In seconds.',
      },
      {
        n: '03',
        title: 'Go to the cheapest',
        body: 'Move your basket to the best-value store and see the nearest branch. Find out instantly how much you saved.',
      },
    ],
  },

  savings: {
    eyebrow: 'What is it worth?',
    titleLead: 'On an average basket,',
    titleAccentSuffix: ' less to pay',
    sub: 'The average difference people leave behind when they move their list to the best-value store. It looks small; over a month, over a year, it adds up.',
    stats: [
      { key: 'products', label: 'matched products' },
      { key: 'branches', label: 'store branches' },
      { key: 'countries', label: 'countries, one app' },
      { key: 'updates', label: 'price updates' },
    ],
    updatesValue: 'Every day',
  },

  coverage: {
    eyebrow: 'Coverage',
    titleLead: 'Live in five countries,',
    titleAccent: 'more of Europe coming',
    sub: 'Turkey, Poland, Croatia, Hungary and Romania. Prices are matched by barcode and refreshed daily from real store data.',
    countries: [
      { code: 'TR', name: 'Turkey' },
      { code: 'PL', name: 'Poland' },
      { code: 'HR', name: 'Croatia' },
      { code: 'HU', name: 'Hungary' },
      { code: 'RO', name: 'Romania' },
    ],
    branchesUnit: 'branches',
    live: 'Live',
    soon: 'Soon',
  },

  features: {
    eyebrow: 'Features',
    title: 'Not just price — judgement',
    sub: 'The details that make Cheep genuinely useful.',
    items: [
      {
        emoji: '🔖',
        title: 'Barcode-matched prices',
        body: 'Not “milk” — that milk. We match products by EAN barcode, so you compare the exact same item across stores. No misleading matches.',
      },
      {
        emoji: '📍',
        title: 'Nearest branch',
        body: 'Shows the nearest and cheapest branch by real distance from your location.',
      },
      {
        emoji: '🤖',
        title: 'Cheep Assistant',
        body: 'Ask “where is breakfast cheapest this week?” and let the AI build your list.',
      },
      {
        emoji: '📈',
        title: 'Price history',
        body: 'Did it really get cheaper? See the past price and don’t fall for a fake discount.',
      },
      {
        emoji: '🧺',
        title: 'Smart lists',
        body: 'Build your basket and see, at a glance, what it totals in each store.',
      },
    ],
  },

  faq: {
    eyebrow: 'FAQ',
    title: 'Common questions',
    sub: 'From where Cheep gets its prices to what the app costs.',
    items: [
      {
        q: 'What is Cheep and what is it for?',
        a: 'Cheep is a free shopping app that compares supermarket prices. You build a shopping list, Cheep compares every item across stores, shows what your list totals in each one, and puts the cheapest basket in front of you.',
      },
      {
        q: 'Where do the prices come from and how often are they updated?',
        a: 'In Turkey prices come from the public, official source of the Ministry of Trade (marketfiyati.org.tr); in Hungary from the official price monitor of the Competition Authority (GVH); in Romania from the state Monitorul Prețurilor system; and in Poland and Croatia from the price lists the chains publish publicly. Prices are updated daily. They are for information only and may differ from the price at the checkout.',
      },
      {
        q: 'Which stores does it compare?',
        a: 'In Turkey: Migros, A101, BİM, ŞOK, CarrefourSA and Tarım Kredi. In Poland: Biedronka, Lidl, Żabka, Auchan and Carrefour. In Croatia: Konzum, Lidl, Spar, Plodine, Kaufland and Tommy. In Hungary: Tesco, Lidl, Aldi, Auchan and Penny. In Romania: Kaufland, Lidl, Carrefour, Auchan, Mega Image and Penny. In total we cover more than 27,500 store branches.',
      },
      {
        q: 'Is the app free?',
        a: 'Yes. Downloading and using Cheep is free: price comparison, lists, the cheapest route and price-drop alerts are always free. The free version shows small ads in a few places. The optional Cheep Premium subscription removes them entirely and raises the AI assistant’s message quota; the terms are in the Terms of Use.',
      },
      {
        q: 'How do you know it is the same product?',
        a: 'We match products by EAN barcode, not by name. So it is not “milk” against “milk” — it is exactly the same brand, the same size, the same product. No misleading matches.',
      },
      {
        q: 'Which countries can I use it in? Is there an iPhone version?',
        a: 'Cheep is currently live in Turkey, Poland, Croatia, Hungary and Romania; Germany, Switzerland and Sweden are on the way. The app can be downloaded from both Google Play and the App Store.',
      },
    ],
  },

  download: {
    titleLead: 'Make your next basket',
    titleAccent: 'cheaper',
    sub: 'Download Cheep, build your list, see the saving. Free in five countries.',
    playAlt: 'Get it on Google Play',
    appStoreAlt: 'Download on the App Store',
    note: 'Free to download · ad-free with optional Premium · Android 8.0 and iOS 15.1 or newer',
  },

  footer: {
    tagline: 'Same product, cheapest price. Compare supermarket prices and save on every basket.',
    cols: [
      {
        title: 'Product',
        links: [
          { label: 'How it works', href: '#how' },
          { label: 'Features', href: '#features' },
          { label: 'Countries', href: '#coverage' },
          { label: 'FAQ', href: '#faq' },
          { label: 'Download', href: '#download' },
        ],
      },
      {
        title: 'Prices',
        links: [
          { label: 'Price report', href: '/price-report' },
          { label: 'Cheapest stores', href: '/cheapest-stores' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Privacy Policy', href: '/privacy' },
          { label: 'Delete account', href: '/delete' },
          { label: 'Terms of Use', href: '/terms' },
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
      'All brand names and logos are registered trademarks of their respective owners. Cheep has no official partnership or affiliation with these retailers; brand names are used solely to indicate whose price is being shown. In Turkey prices come from the public, official source of the Ministry of Trade (marketfiyati.org.tr); in Hungary from the official price monitor of the Competition Authority (GVH); in Romania from the Monitorul Prețurilor system; and in Poland and Croatia from the price lists the stores publish publicly. They are for information only and may differ from the price at the checkout.',
    copyright: '© 2026 Cheep. All rights reserved.',
    madeIn: 'Made with love for Turkey, Poland, Croatia, Hungary and Romania',
  },

  legal: {
    eyebrow: 'Cheep · Legal',
    updatedPrefix: 'Last updated:',
    backHome: '← Home',

    privacy: {
      title: 'Privacy Policy',
      updated: '2 July 2026',
      blocks: [
        { p: 'At Cheep (“we”, “the app”) we care about your privacy. This policy explains what data we collect when you use the Cheep mobile app and the **cheep.live** website, why we collect it, and what your rights are. Cheep is a savings app that compares supermarket prices; we do **not sell** your data.' },
        { h2: 'Data we collect' },
        { h3: 'Because you provide it' },
        { ul: [
          '**Account details:** your email address, your name and your password (your password is never stored in plain text; it is hashed irreversibly with bcrypt).',
          '**Preferences:** your country and language choice.',
          '**In-app content:** the shopping lists you create, your favourite stores, the price feedback you send and the messages you write to the Cheep Assistant.',
        ] },
        { h3: 'When you give permission' },
        { ul: [
          '**Location:** used only if you allow it, and only to show you the nearest store branches and real distances. Your device coordinates are sent to our server for that calculation. Your location is not tracked continuously and is not collected in the background.',
          '**Notification identifier:** if you allow notifications, a device-specific notification identifier (push token) is stored and linked to your account. It is used only to send you notifications, and it is deleted when you turn notifications off or sign out.',
        ] },
        { h3: 'Automatically' },
        { ul: [
          '**Basic technical data:** standard log records needed for the app to run and for troubleshooting (e.g. device type, error logs).',
        ] },
        { h2: 'Why we use the data' },
        { ul: [
          'To match products by barcode and compare store prices.',
          'To show you the nearest and best-value branch.',
          'To create your account and handle sign-in and email verification.',
          'To answer your questions through the Cheep Assistant.',
          'To improve the app and keep it secure.',
        ] },
        { h2: 'Sharing with third parties' },
        { p: 'We do not sell your data for marketing. There is only limited sharing, and only where the service needs it:' },
        { ul: [
          '**Cheep Assistant (AI):** the messages you write to the assistant are sent to Google’s Gemini service to generate a reply.',
          '**Email:** verification and notification emails are sent through the Resend infrastructure.',
          '**Store links:** when you tap a link belonging to a store you are taken to that store’s website; no personal information of yours is shared in the process.',
          '**Legal obligation:** data may be shared with the competent authorities where legally required.',
        ] },
        { h2: 'Security of your data' },
        { p: 'All traffic between the app and our servers is encrypted with HTTPS (TLS). Passwords are hashed with bcrypt. Even so, we remind you that no transmission over the internet is 100% secure.' },
        { h2: 'Retention and deletion' },
        { p: 'We keep your data for as long as your account is active. You can permanently delete your account and all associated data at any time:' },
        { ul: [
          'In the app from **Profile → Delete my account**, or',
          'Using the form at [cheep.live/delete](/delete).',
        ] },
        { p: 'Deletion cannot be undone; all of your data is permanently removed, including your lists, favourite stores, feedback and assistant conversations.' },
        { h2: 'Your rights (GDPR / KVKK)' },
        { p: 'You have the right to access your data, to ask for it to be corrected or deleted, and to object to processing. To exercise these rights, write to [gizlilik@cheep.live](mailto:gizlilik@cheep.live).' },
        { h2: 'Children' },
        { p: 'Cheep is not directed at children under 13 and does not knowingly collect data from them.' },
        { h2: 'Changes' },
        { p: 'We may update this policy from time to time. For significant changes we will let you know in the app or by email. The current version is always on this page.' },
        { h2: 'Contact' },
        { p: 'Questions: [gizlilik@cheep.live](mailto:gizlilik@cheep.live)' },
      ],
    },

    terms: {
      title: 'Terms of Use',
      updated: '25 August 2026',
      blocks: [
        { p: 'By using Cheep you accept these terms. Cheep is an informational tool that helps you compare supermarket prices.' },
        { h2: 'Nature of the service' },
        { ul: [
          'Prices are collected regularly from publicly available store sources and updated daily.',
          'Prices are for information only and may differ from the price actually in force in the store. What binds is the price at the store’s checkout.',
          'Cheep is not a point of sale; it does not sell products and does not take payments.',
        ] },
        { h2: 'Your account' },
        { ul: [
          'You must register with accurate details and you are responsible for the security of your account.',
          'You can [delete your account](/delete) at any time.',
        ] },
        { h2: 'Brand names and intellectual property' },
        { ul: [
          'All store and product brand names and logos appearing in the app are registered trademarks of their respective owners. These names are used referentially, solely to indicate **whose price is being shown** (nominative fair use).',
          'Cheep has **no official partnership, affiliation or collaboration** with the retailers named and is not endorsed by them.',
          'Price information is compiled from publicly available sources. Any trademark owner wishing to raise a claim about content can reach us at [destek@cheep.live](mailto:destek@cheep.live); we respond promptly to legitimate requests.',
        ] },
        { h2: 'Cheep Premium subscription' },
        { p: 'Cheep’s price comparison, shopping list, cheapest route and price-drop alert features are free and will stay free. The free version shows ads. Cheep Premium is an optional subscription that removes the ads and raises the AI assistant’s message quota.' },
        { ul: [
          '**Scope:** on the free tier you can send the assistant 5 messages a day and the app shows ads. With Premium you can send 300 messages a month (with a 50-a-day safety limit) and the ads disappear entirely. All other features are identical in both cases.',
          '**Term and price:** the subscription is offered monthly or yearly. The applicable price, currency and period are shown clearly on the in-app purchase screen before you buy, and may vary by country.',
          '**Auto-renewal:** the subscription renews automatically unless it is cancelled at least 24 hours before the period ends. Payment is charged to your store account within the 24 hours before renewal.',
          '**Cancellation:** you can cancel at any time in the subscription settings of your store account on your device (App Store: Settings → Apple Account → Subscriptions; Google Play: Play Store → Subscriptions). Cancellation takes effect at the end of the paid period in progress; until then you keep your Premium benefits.',
          '**Payment and refunds:** payment is taken by the store you downloaded the app from (Apple App Store or Google Play); Cheep never sees or stores your card details. Refund requests are subject to that store’s refund policy and are made directly to it.',
          '**Trial period:** where a free trial is offered, the subscription continues as paid unless it is cancelled before the trial ends. Any unused part of a trial ends when a subscription is purchased.',
        ] },
        { h2: 'Limitation of liability' },
        { p: 'Cheep gives no warranty as to the completeness or currency of price information and cannot be held responsible for the consequences of decisions you make in reliance on it.' },
        { h2: 'Changes' },
        { p: 'We may update these terms; the current version is always published on this page.' },
        { h2: 'Contact' },
        { p: '[destek@cheep.live](mailto:destek@cheep.live)' },
      ],
    },

    del: {
      title: 'Delete account',
      updated: '2 July 2026',
      intro: [
        { p: 'You can permanently delete your Cheep account and **all of your data** (shopping lists, favourite stores, price feedback, assistant conversations and profile). This **cannot be undone**.' },
        { h2: 'From the app' },
        { p: 'The quickest way: in the Cheep app, go to **Profile → Delete my account**.' },
        { h2: 'No app? Delete from the web' },
        { p: 'If you have removed the app, verify below with your account email and password and delete it. These details are used only to confirm your identity.' },
      ],
      emailLabel: 'Email',
      emailPlaceholder: 'you@example.com',
      passwordLabel: 'Password',
      confirmLabel: 'I understand that my account and all my data will be permanently deleted and that this cannot be undone.',
      submit: 'Permanently delete my account',
      submitting: 'Deleting…',
      deletedTitle: '✓ Deleted',
      successFallback: 'Your account and all your data have been permanently deleted.',
      errorFallback: 'Deletion failed. Check your email and password.',
      networkError: 'Could not reach the server. Please try again later.',
      help: [
        { h2: 'Help' },
        { p: 'If you run into trouble, write to [destek@cheep.live](mailto:destek@cheep.live) and we will delete your account for you.' },
      ],
    },
  },

  seo: {
    home: {
      title: 'Cheep — Compare Supermarket Prices',
      description:
        'Compare the price of the same product across supermarkets in five countries. Move your shopping list to the cheapest store and save on every basket. Free to download.',
    },
    privacy: {
      title: 'Privacy Policy — Cheep',
      description:
        'What data does Cheep collect, why, and what are your rights? Our privacy policy under GDPR and KVKK.',
    },
    terms: {
      title: 'Terms of Use — Cheep',
      description:
        'Cheep terms of use: the nature of the service, where price data comes from, brand names and limitation of liability.',
    },
    del: {
      title: 'Delete account — Cheep',
      description:
        'Permanently delete your Cheep account and all your data. From the app or the form on this page, in one step.',
    },
    appDescription:
      'Cheep is a free shopping app that compares supermarket prices by barcode. It moves your shopping list to the cheapest store and shows you the nearest branch.',
  },
}
