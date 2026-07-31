import type { Dict } from './types'

/** Referans sözlük. `pl.ts` bu şekle uymak zorundadır (Dict tipi). */
export const tr: Dict = {
  htmlLang: 'tr',
  ogLocale: 'tr_TR',

  nav: {
    links: [
      { label: 'Nasıl çalışır', href: '#how' },
      { label: 'Tasarruf', href: '#savings' },
      { label: 'Ülkeler', href: '#coverage' },
      { label: 'Özellikler', href: '#features' },
      { label: 'SSS', href: '#faq' },
    ],
    download: 'İndir',
    openMenu: 'Menüyü aç',
    closeMenu: 'Menüyü kapat',
    home: 'Cheep ana sayfa',
    langSwitchTo: 'Polski',
  },

  hero: {
    badge: 'Türkiye ve Polonya’da canlı · 5 ülke',
    titleLine1: 'Aynı ürün.',
    titleLine2: 'En ucuz fiyat.',
    sub: 'Cheep, marketlerin fiyatlarını tek tek karşılaştırır; alışveriş listeni en uygun sepete taşır. Her gün güncellenen gerçek fiyatlarla, hiç düşünmeden tasarruf et.',
    ctaPrimary: 'Uygulamayı indir',
    ctaSecondary: 'Nasıl çalışır?',
    // Fiyatlar örnektir. Son fiyat en ucuz olacak şekilde sıralanır.
    ticker: [
      { product: 'Süt 1L', prices: ['Migros ₺31,00', 'A101 ₺28,50', 'ŞOK ₺27,90'] },
      { product: 'Yumurta 10’lu', prices: ['CarrefourSA ₺59,00', 'A101 ₺57,50', 'BİM ₺54,90'] },
      { product: 'Zeytinyağı 1L', prices: ['Migros ₺319', 'A101 ₺299', 'ŞOK ₺289'] },
      { product: 'Ekmek', prices: ['A101 ₺8,00', 'BİM ₺7,90', 'Halk ₺7,50'] },
      { product: 'Çay 1kg', prices: ['Migros ₺214', 'ŞOK ₺199', 'BİM ₺189'] },
    ],
    tagCheapest: '✓ en ucuz',
    tagSaving: '%18 tasarruf',
  },

  compare: {
    eyebrow: 'Resmi veri · her gün güncel',
    titleLead: 'Aynı ürün,',
    titleAccent: 'her markette farklı fiyat.',
    body: 'Bir kutu süt için marketten markete %10–15 fark ödeyebilirsin. Cheep, aynı ürünün zincirlerdeki fiyatını yan yana koyar ve en ucuzunu saniyede önüne getirir — tahmin yok, gezmek yok.',
    sourceNote: 'Türkiye’de T.C. Ticaret Bakanlığı resmi verisi · her gün güncel',
    card: {
      name: 'Tam Yağlı Süt',
      unit: '1 L · aynı marka, aynı ürün',
      emoji: '🥛',
      rows: [
        { store: 'Migros', price: '₺31,00', color: '#FF7A00' },
        { store: 'A101', price: '₺28,50', color: '#00507D' },
        { store: 'BİM', price: '₺29,40', color: '#6B8E7F' },
        { store: 'ŞOK', price: '₺27,90', cheapest: true, color: '#E31E24' },
      ],
      cheapestBadge: 'En ucuz',
      savingLabel: 'Bu üründe tasarrufun',
      savingValue: '₺3,10 · %10',
    },
  },

  how: {
    eyebrow: 'Nasıl çalışır',
    title: 'Üç adımda tasarruf',
    sub: 'Karmaşık değil. Listeni ver, gerisini Cheep halletsin.',
    steps: [
      {
        n: '01',
        title: 'Listeni oluştur',
        body: 'Alacaklarını yaz ya da ürünleri ara. Süt, yumurta, deterjan… ne varsa listene ekle.',
      },
      {
        n: '02',
        title: 'Cheep karşılaştırır',
        body: 'Her ürünü barkodundan eşleştirip tüm marketlerin güncel fiyatlarını tarar. Saniyeler içinde.',
      },
      {
        n: '03',
        title: 'En ucuza git',
        body: 'Sepetini en uygun markete taşı, en yakın şubeyi gör. Ne kadar kazandığını anında öğren.',
      },
    ],
  },

  savings: {
    eyebrow: 'Ne kadar ediyor?',
    titleLead: 'Ortalama bir sepette',
    titleAccentSuffix: ' daha az öde',
    sub: 'Kullanıcıların listelerini en uygun markete taşıdığında bıraktığı ortalama fark. Küçük gibi görünür; ayda, yılda toplamı büyür.',
    stats: [
      { key: 'products', label: 'eşleştirilmiş ürün' },
      { key: 'branches', label: 'market şubesi' },
      { key: 'countries', label: 'ülke, tek uygulama' },
      { key: 'updates', label: 'fiyat güncellemesi' },
    ],
    updatesValue: 'Her gün',
  },

  coverage: {
    eyebrow: 'Kapsam',
    titleLead: 'Türkiye ve Polonya’da canlı,',
    titleAccent: 'Avrupa yolda',
    sub: 'Aynı motor beş ülkede çalışıyor. Fiyatlar barkod bazında eşleşiyor, her gün gerçek mağaza verisiyle güncelleniyor.',
    countries: [
      { code: 'TR', name: 'Türkiye' },
      { code: 'PL', name: 'Polonya' },
      { code: 'DE', name: 'Almanya' },
      { code: 'CH', name: 'İsviçre' },
      { code: 'SE', name: 'İsveç' },
    ],
    branchesUnit: 'şube',
    live: 'Canlı',
    soon: 'Yakında',
  },

  features: {
    eyebrow: 'Özellikler',
    title: 'Sadece fiyat değil, akıl',
    sub: 'Cheep’i gerçekten kullanışlı yapan detaylar.',
    items: [
      {
        emoji: '🔖',
        title: 'Barkod eşleştirmeli fiyat',
        body: '“Süt” değil, o süt. Ürünleri EAN barkodundan eşleştiririz; farklı marketlerdeki tam aynı ürünü birebir karşılaştırırsın. Yanıltıcı eşleşme yok.',
      },
      {
        emoji: '📍',
        title: 'En yakın şube',
        body: 'Konumundan gerçek mesafeyle en yakın ve en ucuz şubeyi gösterir.',
      },
      {
        emoji: '🤖',
        title: 'Cheep Asistan',
        body: '“Bu hafta kahvaltılık en ucuz nerede?” diye sor, yapay zekâ listeni kursun.',
      },
      {
        emoji: '📈',
        title: 'Fiyat geçmişi',
        body: 'Bir ürün gerçekten ucuzladı mı? Geçmiş fiyatı gör, indirime kanma.',
      },
      {
        emoji: '🧺',
        title: 'Akıllı listeler',
        body: 'Sepetini oluştur; hangi markette toplam ne kadar tutuyor, tek bakışta gör.',
      },
    ],
  },

  faq: {
    eyebrow: 'Sık sorulanlar',
    title: 'Merak edilenler',
    sub: 'Cheep’in fiyatları nereden aldığından uygulamanın ücretine kadar.',
    items: [
      {
        q: 'Cheep nedir, ne işe yarar?',
        a: 'Cheep, market fiyatlarını karşılaştıran ücretsiz bir alışveriş uygulamasıdır. Alışveriş listeni oluşturursun, Cheep her ürünü marketler arasında karşılaştırıp listenin hangi markette toplam kaça geldiğini gösterir ve en ucuz sepeti önüne koyar.',
      },
      {
        q: 'Fiyatlar nereden geliyor ve ne sıklıkla güncelleniyor?',
        a: 'Türkiye’de fiyatlar T.C. Ticaret Bakanlığı’nın herkese açık resmi kaynağından (marketfiyati.org.tr), Polonya’da ise market zincirlerinin herkese açık kaynaklarından derlenir. Fiyatlar her gün güncellenir. Bilgilendirme amaçlıdır; kasadaki güncel fiyattan farklı olabilir.',
      },
      {
        q: 'Hangi marketlerin fiyatlarını karşılaştırıyor?',
        a: 'Türkiye’de Migros, A101, BİM, ŞOK, CarrefourSA ve Tarım Kredi Kooperatif; Polonya’da Biedronka, Lidl, Żabka, Auchan ve Carrefour. Toplam 23.500’den fazla market şubesini kapsıyoruz.',
      },
      {
        q: 'Uygulama ücretsiz mi?',
        a: 'Evet. Cheep’i indirmek ve kullanmak tamamen ücretsizdir. Abonelik yok, fiyat görmek için ödeme yok.',
      },
      {
        q: 'Aynı ürün olduğundan nasıl emin oluyorsunuz?',
        a: 'Ürünleri isimden değil, EAN barkodundan eşleştiriyoruz. Yani “süt” ile “süt” değil, tam olarak aynı marka, aynı gramaj, aynı ürün karşılaştırılıyor. Yanıltıcı eşleşme olmuyor.',
      },
      {
        q: 'Hangi ülkelerde kullanabilirim? iPhone sürümü var mı?',
        a: 'Cheep şu anda Türkiye ve Polonya’da canlı; Almanya, İsviçre ve İsveç yolda. Uygulama Android’de Google Play’den indirilebilir; iOS sürümü hazırlanıyor.',
      },
    ],
  },

  download: {
    titleLead: 'Bir sonraki sepetin',
    titleAccent: 'daha ucuz',
    sub: 'Cheep’i indir, listeni oluştur, tasarrufu gör. Türkiye ve Polonya’da ücretsiz.',
    playAlt: 'Google Play’den indirin',
    storeTop: 'Yakında',
    storeBottom: 'App Store',
    note: 'Ücretsiz · reklamsız · Android 8.0 ve üzeri',
  },

  footer: {
    tagline: 'Aynı ürün, en ucuz fiyat. Marketlerin fiyatlarını karşılaştır, her sepette tasarruf et.',
    cols: [
      {
        title: 'Ürün',
        links: [
          { label: 'Nasıl çalışır', href: '#how' },
          { label: 'Özellikler', href: '#features' },
          { label: 'Ülkeler', href: '#coverage' },
          { label: 'SSS', href: '#faq' },
          { label: 'İndir', href: '#download' },
        ],
      },
      {
        title: 'Yasal',
        links: [
          { label: 'Gizlilik Politikası', href: '/privacy' },
          { label: 'Hesap Silme', href: '/delete' },
          { label: 'Kullanım Şartları', href: '/terms' },
        ],
      },
      {
        title: 'İletişim',
        links: [
          { label: 'destek@cheep.live', href: 'mailto:destek@cheep.live' },
          { label: 'gizlilik@cheep.live', href: 'mailto:gizlilik@cheep.live' },
        ],
      },
    ],
    disclaimer:
      'Tüm marka adları ve logoları ilgili sahiplerinin tescilli markalarıdır. Cheep bu marketlerle resmi bir ortaklık veya iş birliği içinde değildir; marka adları yalnızca hangi markete ait fiyatın gösterildiğini belirtmek için kullanılır. Türkiye’de fiyatlar T.C. Ticaret Bakanlığı’nın herkese açık resmi kaynağından (marketfiyati.org.tr), Polonya’da ise marketlerin herkese açık kaynaklarından derlenir; bilgilendirme amaçlıdır ve kasadaki güncel fiyattan farklı olabilir.',
    copyright: '© 2026 Cheep. Tüm hakları saklıdır.',
    // Bayrak emojileri Windows'ta harf çiftine düşüyor ("TR PL") — metin kullan.
    madeIn: 'Türkiye ve Polonya için sevgiyle yapıldı',
  },

  legal: {
    eyebrow: 'Cheep · Yasal',
    updatedPrefix: 'Son güncelleme:',
    backHome: '← Ana sayfa',

    privacy: {
      title: 'Gizlilik Politikası',
      updated: '2 Temmuz 2026',
      blocks: [
        { p: 'Cheep (“biz”, “uygulama”) olarak gizliliğine önem veriyoruz. Bu politika, Cheep mobil uygulamasını ve **cheep.live** sitesini kullandığında hangi verileri topladığımızı, neden topladığımızı ve haklarını açıklar. Cheep, marketlerin fiyatlarını karşılaştıran bir tasarruf uygulamasıdır; verini **satmayız**.' },
        { h2: 'Topladığımız veriler' },
        { h3: 'Sen sağladığın için' },
        { ul: [
          '**Hesap bilgileri:** e-posta adresin, adın ve şifren (şifren asla düz metin olarak saklanmaz, bcrypt ile geri döndürülemez şekilde şifrelenir).',
          '**Tercihler:** ülke ve dil seçimin.',
          '**Uygulama içeriği:** oluşturduğun alışveriş listeleri, favori marketlerin, verdiğin fiyat geri bildirimleri ve Cheep Asistan’a yazdığın mesajlar.',
        ] },
        { h3: 'İzin verdiğinde' },
        { ul: [
          '**Yaklaşık konum:** yalnızca izin verirsen ve sana en yakın market şubelerini göstermek için kullanılır. Konumun sürekli takip edilmez, arka planda toplanmaz.',
        ] },
        { h3: 'Otomatik olarak' },
        { ul: [
          '**Temel teknik veriler:** uygulamanın çalışması ve hataların giderilmesi için gerekli standart günlük kayıtları (ör. cihaz tipi, hata kayıtları).',
        ] },
        { h2: 'Verileri neden kullanıyoruz' },
        { ul: [
          'Ürünleri barkodundan eşleştirip market fiyatlarını karşılaştırmak.',
          'Sana en yakın ve en uygun şubeyi göstermek.',
          'Hesabını oluşturmak, girişini ve e-posta doğrulamanı sağlamak.',
          'Cheep Asistan ile sorularını yanıtlamak.',
          'Uygulamayı geliştirmek ve güvenliğini korumak.',
        ] },
        { h2: 'Üçüncü taraflarla paylaşım' },
        { p: 'Verini pazarlama amacıyla satmayız. Yalnızca hizmetin çalışması için gerekli sınırlı paylaşımlar olur:' },
        { ul: [
          '**Cheep Asistan (yapay zekâ):** asistana yazdığın mesajlar, yanıt üretmek için Google’ın Gemini servisine iletilir.',
          '**E-posta:** doğrulama ve bilgilendirme e-postaları Resend altyapısı üzerinden gönderilir.',
          '**Market yönlendirmeleri:** bir markete ait bağlantıya dokunduğunda ilgili marketin sitesine yönlendirilirsin; bu sırada kişisel bilgin paylaşılmaz.',
          '**Yasal zorunluluk:** hukuken gerekli olduğunda yetkili mercilerle paylaşılabilir.',
        ] },
        { h2: 'Verinin güvenliği' },
        { p: 'Uygulama ile sunucularımız arasındaki tüm trafik HTTPS (TLS) ile şifrelenir. Şifreler bcrypt ile hash’lenir. Yine de internet üzerinden hiçbir aktarımın %100 güvenli olmadığını hatırlatırız.' },
        { h2: 'Verinin saklanması ve silinmesi' },
        { p: 'Verilerini hesabın aktif olduğu sürece saklarız. Dilediğin an hesabını ve tüm ilişkili verilerini kalıcı olarak silebilirsin:' },
        { ul: [
          'Uygulamada **Profil → Hesabımı Sil** adımından, veya',
          '[cheep.live/delete](/delete) sayfasındaki formdan.',
        ] },
        { p: 'Silme işlemi geri alınamaz; listelerin, favori marketlerin, geri bildirimlerin ve asistan sohbetlerin dahil tüm verilerin kalıcı olarak kaldırılır.' },
        { h2: 'Haklarının (KVKK / GDPR)' },
        { p: 'Verilerine erişme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme haklarına sahipsin. Bu haklarını kullanmak için [gizlilik@cheep.live](mailto:gizlilik@cheep.live) adresine yazabilirsin.' },
        { h2: 'Çocuklar' },
        { p: 'Cheep 13 yaş altındaki çocuklara yönelik değildir ve bilerek onlardan veri toplamaz.' },
        { h2: 'Değişiklikler' },
        { p: 'Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişikliklerde uygulama veya e-posta yoluyla bilgilendiririz. Güncel sürüm her zaman bu sayfada yer alır.' },
        { h2: 'İletişim' },
        { p: 'Sorular için: [gizlilik@cheep.live](mailto:gizlilik@cheep.live)' },
      ],
    },

    terms: {
      title: 'Kullanım Şartları',
      updated: '2 Temmuz 2026',
      blocks: [
        { p: 'Cheep’i kullanarak bu şartları kabul etmiş olursun. Cheep, market fiyatlarını karşılaştırman için bilgi amaçlı bir araçtır.' },
        { h2: 'Hizmetin niteliği' },
        { ul: [
          'Fiyatlar marketlerin herkese açık kaynaklarından düzenli olarak toplanır ve her gün güncellenir.',
          'Fiyatlar bilgilendirme amaçlıdır; markette geçerli olan güncel fiyattan farklı olabilir. Bağlayıcı olan marketin kasadaki fiyatıdır.',
          'Cheep bir satış noktası değildir; ürün satmaz, ödeme almaz.',
        ] },
        { h2: 'Hesabın' },
        { ul: [
          'Doğru bilgilerle kayıt olmalısın ve hesabının güvenliğinden sen sorumlusun.',
          'Hesabını dilediğin an [silebilirsin](/delete).',
        ] },
        { h2: 'Marka adları ve fikri mülkiyet' },
        { ul: [
          'Uygulamada geçen tüm market ve ürün marka adları ile logoları, ilgili sahiplerinin tescilli markalarıdır. Bu adlar yalnızca **hangi markete ait fiyatın gösterildiğini belirtmek** için, atıf amacıyla kullanılır (dürüst kullanım).',
          'Cheep, adı geçen marketlerle **resmi bir ortaklık, bağlantı veya iş birliği içinde değildir** ve onlar tarafından desteklenmez.',
          'Fiyat bilgileri herkese açık kaynaklardan derlenir. Herhangi bir marka sahibi içeriğiyle ilgili talepte bulunmak isterse [destek@cheep.live](mailto:destek@cheep.live) üzerinden bize ulaşabilir; haklı taleplere hızla yanıt veririz.',
        ] },
        { h2: 'Sorumluluk sınırı' },
        { p: 'Cheep, fiyat bilgilerinin eksiksizliği veya güncelliği konusunda garanti vermez; bu bilgilere dayanarak verdiğin kararlardan doğan sonuçlardan sorumlu tutulamaz.' },
        { h2: 'Değişiklikler' },
        { p: 'Bu şartları güncelleyebiliriz; güncel sürüm her zaman bu sayfada yayınlanır.' },
        { h2: 'İletişim' },
        { p: '[destek@cheep.live](mailto:destek@cheep.live)' },
      ],
    },

    del: {
      title: 'Hesap Silme',
      updated: '2 Temmuz 2026',
      intro: [
        { p: 'Cheep hesabını ve **tüm verilerini** (alışveriş listeleri, favori marketler, fiyat geri bildirimleri, asistan sohbetleri ve profil) kalıcı olarak silebilirsin. Bu işlem **geri alınamaz**.' },
        { h2: 'Uygulama üzerinden' },
        { p: 'En hızlı yol: Cheep uygulamasında **Profil → Hesabımı Sil** adımını izle.' },
        { h2: 'Uygulaman yoksa: web üzerinden sil' },
        { p: 'Uygulamayı kaldırdıysan, aşağıya hesabının e-posta ve şifresini girerek doğrula ve sil. Bilgiler yalnızca kimliğini doğrulamak için kullanılır.' },
      ],
      emailLabel: 'E-posta',
      emailPlaceholder: 'ornek@eposta.com',
      passwordLabel: 'Şifre',
      confirmLabel: 'Hesabımın ve tüm verilerimin kalıcı olarak silineceğini, bu işlemin geri alınamayacağını anlıyorum.',
      submit: 'Hesabımı kalıcı olarak sil',
      submitting: 'Siliniyor…',
      deletedTitle: '✓ Silindi',
      successFallback: 'Hesabın ve tüm verilerin kalıcı olarak silindi.',
      errorFallback: 'Silme başarısız. E-posta ve şifreni kontrol et.',
      networkError: 'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar dene.',
      help: [
        { h2: 'Yardım' },
        { p: 'Sorun yaşarsan [destek@cheep.live](mailto:destek@cheep.live) adresine yaz; hesabını senin için silelim.' },
      ],
    },
  },

  seo: {
    home: {
      title: 'Cheep — Market Fiyatları Karşılaştırma Uygulaması',
      description:
        'A101, BİM, ŞOK, Migros ve CarrefourSA fiyatlarını aynı üründe karşılaştır. Alışveriş listeni en ucuz markete taşı, her sepette tasarruf et. Ücretsiz indir.',
    },
    privacy: {
      title: 'Gizlilik Politikası — Cheep',
      description:
        'Cheep hangi verileri topluyor, neden topluyor ve haklarınız neler? KVKK ve GDPR kapsamındaki gizlilik politikamız.',
    },
    terms: {
      title: 'Kullanım Şartları — Cheep',
      description:
        'Cheep kullanım şartları: hizmetin niteliği, fiyat bilgilerinin kaynağı, marka adları ve sorumluluk sınırı.',
    },
    del: {
      title: 'Hesap Silme — Cheep',
      description:
        'Cheep hesabını ve tüm verilerini kalıcı olarak sil. Uygulamadan veya bu sayfadaki formdan tek adımda.',
    },
    appDescription:
      'Cheep, market fiyatlarını barkod bazında karşılaştıran ücretsiz bir alışveriş uygulamasıdır. Alışveriş listeni en ucuz markete taşır, en yakın şubeyi gösterir.',
  },
}
