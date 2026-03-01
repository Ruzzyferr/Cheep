/**
 * STANDARD CATEGORIES
 * 
 * Tüm marketler için sabit kategori yapısı.
 * Bu yapı değişmez - yeni kategori eklemek için bu dosyayı güncellemek gerekir.
 */

export interface StandardCategory {
    name: string;
    slug: string;
    icon?: string;
    displayOrder: number;
    subcategories: StandardSubcategory[];
}

export interface StandardSubcategory {
    name: string;
    slug: string;
    displayOrder: number;
}

/**
 * Sabit Ana Kategoriler ve Alt Kategorileri
 * Tüm marketler için aynı kategori yapısı kullanılır.
 */
export const STANDARD_CATEGORIES: StandardCategory[] = [
    {
        name: 'Süt Ürünleri',
        slug: 'sut-urunleri',
        icon: '🥛',
        displayOrder: 1,
        subcategories: [
            { name: 'Süt', slug: 'sut', displayOrder: 1 },
            { name: 'Peynir', slug: 'peynir', displayOrder: 2 },
            { name: 'Yoğurt', slug: 'yogurt', displayOrder: 3 },
            { name: 'Krema ve Kaymak', slug: 'krema-kaymak', displayOrder: 4 },
            { name: 'Tereyağı', slug: 'tereyagi', displayOrder: 5 },
            { name: 'Margarin', slug: 'margarin', displayOrder: 6 },
            { name: 'Ayran', slug: 'ayran', displayOrder: 7 },
            { name: 'Kefir', slug: 'kefir', displayOrder: 8 },
            { name: 'Sütlü Tatlılar', slug: 'sutlu-tatlilar', displayOrder: 9 },
            { name: 'Dondurulmuş Süt Ürünleri', slug: 'dondurulmus-sut-urunleri', displayOrder: 10 },
        ],
    },
    {
        name: 'Meyve & Sebze',
        slug: 'meyve-sebze',
        icon: '🍎',
        displayOrder: 2,
        subcategories: [
            { name: 'Meyve', slug: 'meyve', displayOrder: 1 },
            { name: 'Sebze', slug: 'sebze', displayOrder: 2 },
            { name: 'Salata Malzemeleri', slug: 'salata-malzemeleri', displayOrder: 3 },
            { name: 'Kuru Meyve', slug: 'kuru-meyve', displayOrder: 4 },
            { name: 'Kuru Sebze', slug: 'kuru-sebze', displayOrder: 5 },
            { name: 'Közlenmiş', slug: 'kozlenmis', displayOrder: 6 },
            { name: 'İncir', slug: 'incir', displayOrder: 7 },
        ],
    },
    {
        name: 'Et, Tavuk, Balık',
        slug: 'et-tavuk-balik',
        icon: '🍖',
        displayOrder: 3,
        subcategories: [
            { name: 'Kırmızı Et', slug: 'kirmizi-et', displayOrder: 1 },
            { name: 'Tavuk', slug: 'tavuk', displayOrder: 2 },
            { name: 'Hindi', slug: 'hindi', displayOrder: 3 },
            { name: 'Balık', slug: 'balik', displayOrder: 4 },
            { name: 'Deniz Ürünleri', slug: 'deniz-urunleri', displayOrder: 5 },
            { name: 'Şarküteri', slug: 'sarkuteri', displayOrder: 6 },
            { name: 'Salam', slug: 'salam', displayOrder: 7 },
            { name: 'Sucuk', slug: 'sucuk', displayOrder: 8 },
            { name: 'Dondurulmuş Et Ürünleri', slug: 'dondurulmus-et-urunleri', displayOrder: 9 },
        ],
    },
    {
        name: 'Temel Gıda',
        slug: 'temel-gida',
        icon: '🌾',
        displayOrder: 4,
        subcategories: [
            { name: 'Un', slug: 'un', displayOrder: 1 },
            { name: 'Şeker', slug: 'seker', displayOrder: 2 },
            { name: 'Pirinç', slug: 'pirinç', displayOrder: 3 },
            { name: 'Makarna', slug: 'makarna', displayOrder: 4 },
            { name: 'Bulgur', slug: 'bulgur', displayOrder: 5 },
            { name: 'Bakliyat', slug: 'bakliyat', displayOrder: 6 },
            { name: 'Yağ', slug: 'yag', displayOrder: 7 },
            { name: 'Sirke', slug: 'sirke', displayOrder: 8 },
            { name: 'Baharat', slug: 'baharat', displayOrder: 9 },
            { name: 'Salça', slug: 'salca', displayOrder: 10 },
            { name: 'Hazır Çorba', slug: 'hazir-corba', displayOrder: 11 },
            { name: 'İrmik', slug: 'irmik', displayOrder: 12 },
            { name: 'Erişte', slug: 'eriste', displayOrder: 13 },
            { name: 'Kakao', slug: 'kakao', displayOrder: 14 },
            { name: 'Kinoa', slug: 'kinoa', displayOrder: 15 },
            { name: 'Amarant', slug: 'amarant', displayOrder: 16 },
            { name: 'Hardal', slug: 'hardal', displayOrder: 17 },
            { name: 'Vanilin', slug: 'vanilin', displayOrder: 18 },
            { name: 'Chia', slug: 'chia', displayOrder: 19 },
            { name: 'Otlar', slug: 'otlar', displayOrder: 20 },
            { name: 'Yemek Harçları', slug: 'yemek-harclari', displayOrder: 21 },
        ],
    },
    {
        name: 'İçecek',
        slug: 'icecek',
        icon: '🥤',
        displayOrder: 5,
        subcategories: [
            { name: 'Su', slug: 'su', displayOrder: 1 },
            { name: 'Meyve Suyu', slug: 'meyve-suyu', displayOrder: 2 },
            { name: 'Gazlı İçecek', slug: 'gazli-icecek', displayOrder: 3 },
            { name: 'Çay', slug: 'cay', displayOrder: 4 },
            { name: 'Kahve', slug: 'kahve', displayOrder: 5 },
            { name: 'Enerji İçeceği', slug: 'enerji-icecegi', displayOrder: 6 },
            { name: 'Bitki Çayı', slug: 'bitki-cayi', displayOrder: 7 },
            { name: 'Alkolsüz Bira', slug: 'alkolsuz-bira', displayOrder: 8 },
            { name: 'Boza', slug: 'boza', displayOrder: 9 },
            { name: 'Malt İçeceği', slug: 'malt-icecegi', displayOrder: 10 },
        ],
    },
    {
        name: 'Fırın & Pastane',
        slug: 'firin-pastane',
        icon: '🍞',
        displayOrder: 6,
        subcategories: [
            { name: 'Ekmek', slug: 'ekmek', displayOrder: 1 },
            { name: 'Simit', slug: 'simit', displayOrder: 2 },
            { name: 'Poğaça', slug: 'pogaca', displayOrder: 3 },
            { name: 'Börek', slug: 'borek', displayOrder: 4 },
            { name: 'Pasta', slug: 'pasta', displayOrder: 5 },
            { name: 'Kek', slug: 'kek', displayOrder: 6 },
            { name: 'Bisküvi', slug: 'bisküvi', displayOrder: 7 },
            { name: 'Çörek', slug: 'corek', displayOrder: 8 },
            { name: 'Ramazan Pidesi', slug: 'ramazan-pidesi', displayOrder: 9 },
            { name: 'Kruvasan', slug: 'kruvasan', displayOrder: 10 },
        ],
    },
    {
        name: 'Kahvaltılık',
        slug: 'kahvaltilik',
        icon: '🍯',
        displayOrder: 7,
        subcategories: [
            { name: 'Reçel', slug: 'recel', displayOrder: 1 },
            { name: 'Bal', slug: 'bal', displayOrder: 2 },
            { name: 'Zeytin', slug: 'zeytin', displayOrder: 3 },
            { name: 'Tahin & Pekmez', slug: 'tahin-pekmez', displayOrder: 4 },
            { name: 'Helva', slug: 'helva', displayOrder: 5 },
            { name: 'Yumurta', slug: 'yumurta', displayOrder: 6 },
            { name: 'Kahvaltılık Ezme', slug: 'kahvaltilik-ezme', displayOrder: 7 },
            { name: 'Kahvaltılık Sos', slug: 'kahvaltilik-sos', displayOrder: 8 },
            { name: 'Kahvaltılık Gevrek', slug: 'kahvaltilik-gevrek', displayOrder: 9 },
            { name: 'Müsli & Granola', slug: 'musli-granola', displayOrder: 10 },
        ],
    },
    {
        name: 'Atıştırmalık',
        slug: 'atistirmalik',
        icon: '🍫',
        displayOrder: 8,
        subcategories: [
            { name: 'Çikolata', slug: 'cikolata', displayOrder: 1 },
            { name: 'Bisküvi', slug: 'bisküvi-atistirmalik', displayOrder: 2 },
            { name: 'Gofret', slug: 'gofret', displayOrder: 3 },
            { name: 'Kuruyemiş', slug: 'kuruyemiş', displayOrder: 4 },
            { name: 'Cips', slug: 'cips', displayOrder: 5 },
            { name: 'Kraker', slug: 'kraker', displayOrder: 6 },
            { name: 'Şekerleme', slug: 'sekerleme', displayOrder: 7 },
            { name: 'Jelibon', slug: 'jelibon', displayOrder: 8 },
        ],
    },
    {
        name: 'Dondurma',
        slug: 'dondurma',
        icon: '🍦',
        displayOrder: 9,
        subcategories: [
            { name: 'Dondurma', slug: 'dondurma-alt', displayOrder: 1 },
            { name: 'Dondurma Çubuk', slug: 'dondurma-cubuk', displayOrder: 2 },
            { name: 'Donuk Tatlı', slug: 'donuk-tatli', displayOrder: 3 },
        ],
    },
    {
        name: 'Hazır Yemek & Donuk',
        slug: 'hazir-yemek-donuk',
        icon: '🍱',
        displayOrder: 10,
        subcategories: [
            { name: 'Hazır Yemek', slug: 'hazir-yemek', displayOrder: 1 },
            { name: 'Dondurulmuş Gıda', slug: 'dondurulmus-gida', displayOrder: 2 },
            { name: 'Pizza', slug: 'pizza', displayOrder: 3 },
            { name: 'Hamburger & Köfte', slug: 'hamburger-kofte', displayOrder: 4 },
            { name: 'Dondurulmuş Sebze', slug: 'dondurulmus-sebze', displayOrder: 5 },
            { name: 'Dondurulmuş Meyve', slug: 'dondurulmus-meyve', displayOrder: 6 },
        ],
    },
    {
        name: 'Temizlik',
        slug: 'temizlik',
        icon: '🧹',
        displayOrder: 11,
        subcategories: [
            { name: 'Bulaşık Deterjanı', slug: 'bulasik-deterjani', displayOrder: 1 },
            { name: 'Çamaşır Deterjanı', slug: 'camasir-deterjani', displayOrder: 2 },
            { name: 'Yumuşatıcı', slug: 'yumusatici', displayOrder: 3 },
            { name: 'Yüzey Temizleyici', slug: 'yuzey-temizleyici', displayOrder: 4 },
            { name: 'Tuvalet Temizleyici', slug: 'tuvalet-temizleyici', displayOrder: 5 },
            { name: 'Temizlik Malzemeleri', slug: 'temizlik-malzemeleri', displayOrder: 6 },
            { name: 'Çöp Torbası', slug: 'cop-torbasi', displayOrder: 7 },
            { name: 'Eldiven', slug: 'eldiven-temizlik', displayOrder: 8 },
            { name: 'Sünger & Bez', slug: 'sünger-bez', displayOrder: 9 },
            { name: 'Bulaşık Parlatıcı', slug: 'bulasik-parlatici', displayOrder: 10 },
            { name: 'Bulaşık Makinesi Temizleyici', slug: 'bulasik-makinesi-temizleyici', displayOrder: 11 },
            { name: 'Bulaşık Teli', slug: 'bulasik-teli', displayOrder: 12 },
            { name: 'Leke Çıkarıcılar', slug: 'leke-cikaricilar', displayOrder: 13 },
            { name: 'Wc Blok', slug: 'wc-blok', displayOrder: 14 },
            { name: 'Tüy Toplayıcı Rulo', slug: 'tuy-toplayici-rulo', displayOrder: 15 },
            { name: 'Kireç Önleyiciler', slug: 'kirec-onleyiciler', displayOrder: 16 },
            { name: 'Kireç Sökücüler', slug: 'kirec-sokuculer', displayOrder: 17 },
            { name: 'Rezervuar Blok', slug: 'rezervuar-blok', displayOrder: 18 },
            { name: 'Buzdolabı Kokuları', slug: 'buzdolabi-kokulari', displayOrder: 19 },
            { name: 'Otomatik Oda Kokuları', slug: 'otomatik-oda-kokulari', displayOrder: 20 },
        ],
    },
    {
        name: 'Kişisel Bakım',
        slug: 'kisisel-bakim',
        icon: '🧴',
        displayOrder: 12,
        subcategories: [
            { name: 'Şampuan', slug: 'sampuan', displayOrder: 1 },
            { name: 'Sabun', slug: 'sabun', displayOrder: 2 },
            { name: 'Diş Macunu', slug: 'dis-macunu', displayOrder: 3 },
            { name: 'Diş Bakım', slug: 'dis-bakim', displayOrder: 4 },
            { name: 'Deodorant', slug: 'deodorant', displayOrder: 5 },
            { name: 'Cilt Bakım', slug: 'cilt-bakim', displayOrder: 6 },
            { name: 'Tıraş', slug: 'tiras', displayOrder: 7 },
            { name: 'Güneş Koruyucu', slug: 'gunes-koruyucu', displayOrder: 8 },
            { name: 'Tuvalet Kağıdı', slug: 'tuvalet-kagidi', displayOrder: 9 },
            { name: 'Kağıt Havlu', slug: 'kagit-havlu', displayOrder: 10 },
            { name: 'Mendil', slug: 'mendil', displayOrder: 11 },
            { name: 'Peçete', slug: 'pecete', displayOrder: 12 },
            { name: 'Ruj', slug: 'ruj', displayOrder: 13 },
            { name: 'Allık', slug: 'allik', displayOrder: 14 },
            { name: 'Fondöten', slug: 'fondoten', displayOrder: 15 },
            { name: 'Maskara', slug: 'maskara', displayOrder: 16 },
            { name: 'Oje', slug: 'oje', displayOrder: 17 },
            { name: 'Saç Boyaları', slug: 'sac-boyalari', displayOrder: 18 },
            { name: 'Ağda', slug: 'agda', displayOrder: 19 },
            { name: 'Duş Jelleri', slug: 'dus-jelleri', displayOrder: 20 },
            { name: 'Duş Jeli', slug: 'dus-jeli', displayOrder: 21 },
            { name: 'Kolonya', slug: 'kolonya', displayOrder: 22 },
            { name: 'Tampon', slug: 'tampon', displayOrder: 23 },
            { name: 'Günlük Ped', slug: 'gunluk-ped', displayOrder: 24 },
            { name: 'Yara Bandı', slug: 'yara-bandi', displayOrder: 25 },
            { name: 'Diş İpi', slug: 'dis-ipi', displayOrder: 25 },
            { name: 'Pamuk', slug: 'pamuk', displayOrder: 26 },
            { name: 'Tarak', slug: 'tarak', displayOrder: 27 },
            { name: 'Saç Renk Açıcı', slug: 'sac-renk-acici', displayOrder: 28 },
            { name: 'Tüy Sarartıcı', slug: 'tuy-sarartici', displayOrder: 29 },
            { name: 'Vazelin', slug: 'vazelin', displayOrder: 30 },
            { name: 'Prezervatif', slug: 'prezervatif', displayOrder: 31 },
            { name: 'Kürdan', slug: 'kurdan', displayOrder: 32 },
            { name: 'Takma Tırnak, Kirpik', slug: 'takma-tirnak-kirpik', displayOrder: 33 },
            { name: 'Kapatıcı', slug: 'kapatıcı', displayOrder: 34 },
            { name: 'Briyantin', slug: 'briyantin', displayOrder: 35 },
            { name: 'Saç Fırçası', slug: 'sac-fircasi', displayOrder: 36 },
            { name: 'Saç Köpüğü', slug: 'sac-kopugu', displayOrder: 37 },
            { name: 'Yüz Serumu', slug: 'yuz-serumu', displayOrder: 38 },
            { name: 'Yüz Maskesi', slug: 'yuz-maskesi', displayOrder: 39 },
            { name: 'Yüz Toniği', slug: 'yuz-tonigi', displayOrder: 40 },
            { name: 'Bronzlaştırıcı', slug: 'bronzlastirici', displayOrder: 41 },
            { name: 'Maske', slug: 'maske', displayOrder: 42 },
            { name: 'Emzik', slug: 'emzik', displayOrder: 43 },
        ],
    },
    {
        name: 'Bebek',
        slug: 'bebek',
        icon: '👶',
        displayOrder: 13,
        subcategories: [
            { name: 'Bebek Bezi', slug: 'bebek-bezi', displayOrder: 1 },
            { name: 'Bebek Maması', slug: 'bebek-mamasi', displayOrder: 2 },
            { name: 'Bebek Bakım', slug: 'bebek-bakim', displayOrder: 3 },
            { name: 'Bebek Bezlenme', slug: 'bebek-bezlenme', displayOrder: 4 },
        ],
    },
    {
        name: 'Pet Shop',
        slug: 'pet-shop',
        icon: '🐕',
        displayOrder: 14,
        subcategories: [
            { name: 'Kedi Maması', slug: 'kedi-mamasi', displayOrder: 1 },
            { name: 'Köpek Maması', slug: 'kopek-mamasi', displayOrder: 2 },
            { name: 'Kuş Maması', slug: 'kus-mamasi', displayOrder: 3 },
            { name: 'Pet Aksesuar', slug: 'pet-aksesuar', displayOrder: 4 },
        ],
    },
    {
        name: 'Sağlıklı Yaşam',
        slug: 'saglikli-yasam',
        icon: '💊',
        displayOrder: 15,
        subcategories: [
            { name: 'Vitamin & Takviye', slug: 'vitamin-takviye', displayOrder: 1 },
            { name: 'Organik Ürünler', slug: 'organik-urunler', displayOrder: 2 },
            { name: 'Glutensiz', slug: 'glutensiz', displayOrder: 3 },
            { name: 'Şekersiz', slug: 'sekersiz', displayOrder: 4 },
            { name: 'İlk Yardım', slug: 'ilk-yardim', displayOrder: 5 },
        ],
    },
    {
        name: 'Ev & Yaşam',
        slug: 'ev-yasam',
        icon: '🏠',
        displayOrder: 16,
        subcategories: [
            { name: 'Ev Tekstili', slug: 'ev-tekstili', displayOrder: 1 },
            { name: 'Mutfak Gereçleri', slug: 'mutfak-gerecleri', displayOrder: 2 },
            { name: 'Banyo', slug: 'banyo', displayOrder: 3 },
            { name: 'Dekorasyon', slug: 'dekorasyon', displayOrder: 4 },
            { name: 'Spor Ekipmanları', slug: 'spor-ekipmanlari', displayOrder: 5 },
            { name: 'Pil', slug: 'pil', displayOrder: 6 },
            { name: 'Ampul', slug: 'ampul', displayOrder: 7 },
            { name: 'Batteri', slug: 'batteri', displayOrder: 8 },
            { name: 'Elektrikli Isıtıcı', slug: 'elektrikli-isitici', displayOrder: 9 },
            { name: 'Terlik', slug: 'terlik', displayOrder: 10 },
            { name: 'Ütü', slug: 'utu', displayOrder: 11 },
            { name: 'Kablolar', slug: 'kablolar', displayOrder: 12 },
            { name: 'Sırt ve Kol Çantaları', slug: 'sirt-ve-kol-cantalari', displayOrder: 13 },
            { name: 'Cam Sileceği', slug: 'cam-silecegi', displayOrder: 14 },
            { name: 'Kombi', slug: 'kombi', displayOrder: 15 },
            { name: 'Bahçe', slug: 'bahce', displayOrder: 16 },
            { name: 'Bahçe Mobilyaları', slug: 'bahce-mobilyalari', displayOrder: 17 },
            { name: 'Derin Dondurucu', slug: 'derin-dondurucu', displayOrder: 18 },
            { name: 'Vantilatörler', slug: 'ventilatorler', displayOrder: 19 },
            { name: 'Hırdavat', slug: 'hirdavat', displayOrder: 20 },
            { name: 'Güvenlik', slug: 'guvenlik', displayOrder: 21 },
            { name: 'Mama Sandalyesi', slug: 'mama-sandalyesi', displayOrder: 22 },
            { name: 'Ayakkabı Bakım', slug: 'ayakkabi-bakim', displayOrder: 23 },
            { name: 'Ayak Tabanlık', slug: 'ayak-tabanlik', displayOrder: 24 },
            { name: 'Tüp Boya', slug: 'tup-boya', displayOrder: 25 },
            { name: 'Klimalar', slug: 'klimalar', displayOrder: 26 },
            { name: 'Blender', slug: 'blender', displayOrder: 27 },
            { name: 'Plastik Kovalar', slug: 'plastik-kovalar', displayOrder: 28 },
            { name: 'Kamping', slug: 'kamping', displayOrder: 29 },
            { name: 'Mikrodalga', slug: 'mikrodalga', displayOrder: 30 },
            { name: 'Termosifon', slug: 'termosifon', displayOrder: 31 },
            { name: 'Buzdolabı', slug: 'buzdolabi', displayOrder: 32 },
            { name: 'Garnitür', slug: 'garnitur', displayOrder: 33 },
            { name: 'Valizler', slug: 'valizler', displayOrder: 34 },
            { name: 'Masaüstü Gereçleri', slug: 'masaustu-gerecleri', displayOrder: 35 },
            { name: 'Mandal', slug: 'mandal', displayOrder: 36 },
        ],
    },
    {
        name: 'Kitap & Kırtasiye',
        slug: 'kitap-kirtasiye',
        icon: '📚',
        displayOrder: 17,
        subcategories: [
            { name: 'Kitap', slug: 'kitap', displayOrder: 1 },
            { name: 'Kırtasiye', slug: 'kirtasiye', displayOrder: 2 },
            { name: 'Oyuncak', slug: 'oyuncak', displayOrder: 3 },
            { name: 'Puzzle', slug: 'puzzle', displayOrder: 4 },
            { name: 'Eğitim', slug: 'egitim', displayOrder: 5 },
            { name: 'Dosyalama ve Arşivleme', slug: 'dosyalama-arsivleme', displayOrder: 6 },
            { name: 'Hobi-Eğlence', slug: 'hobi-eglence', displayOrder: 7 },
            { name: 'Edebiyat', slug: 'edebiyat', displayOrder: 8 },
            { name: 'Kalem Çeşitleri', slug: 'kalem-cesitleri', displayOrder: 9 },
            { name: 'Defterler', slug: 'defterler', displayOrder: 10 },
        ],
    },
    {
        name: 'Elektronik',
        slug: 'elektronik',
        icon: '📱',
        displayOrder: 18,
        subcategories: [
            { name: 'Telefon Aksesuarları', slug: 'telefon-aksesuarlari', displayOrder: 1 },
            { name: 'Bilgisayar', slug: 'bilgisayar', displayOrder: 2 },
            { name: 'Ses Sistemleri', slug: 'ses-sistemleri', displayOrder: 3 },
            { name: 'Taşınabilir Disk ve USB Bellek', slug: 'tasinabilir-disk-usb', displayOrder: 4 },
            { name: 'Hoparlör', slug: 'hoparlor', displayOrder: 5 },
            { name: 'Foto & Kamera', slug: 'foto-kamera', displayOrder: 6 },
            { name: 'Mouse', slug: 'mouse', displayOrder: 7 },
            { name: 'Klavye', slug: 'klavye', displayOrder: 8 },
            { name: 'Televizyon', slug: 'televizyon', displayOrder: 9 },
            { name: 'Uydu Alıcılar', slug: 'uydu-alicilar', displayOrder: 10 },
        ],
    },
    {
        name: 'Diğer',
        slug: 'diger',
        icon: '📦',
        displayOrder: 19,
        subcategories: [],
    },
];

/**
 * Tüm standart kategori isimlerini (ana + alt) döndürür
 */
export function getAllStandardCategoryNames(): string[] {
    const names: string[] = [];
    for (const category of STANDARD_CATEGORIES) {
        names.push(category.name);
        for (const subcategory of category.subcategories) {
            names.push(subcategory.name);
        }
    }
    return names;
}

/**
 * Standart kategori slug'larını döndürür
 */
export function getAllStandardCategorySlugs(): string[] {
    const slugs: string[] = [];
    for (const category of STANDARD_CATEGORIES) {
        slugs.push(category.slug);
        for (const subcategory of category.subcategories) {
            slugs.push(subcategory.slug);
        }
    }
    return slugs;
}

/**
 * İsme göre standart kategori bulur (ana veya alt)
 */
export function findStandardCategoryByName(name: string): StandardCategory | StandardSubcategory | null {
    const normalizedName = name.trim();
    
    // Ana kategorileri kontrol et
    for (const category of STANDARD_CATEGORIES) {
        if (category.name === normalizedName) {
            return category;
        }
        // Alt kategorileri kontrol et
        for (const subcategory of category.subcategories) {
            if (subcategory.name === normalizedName) {
                return subcategory;
            }
        }
    }
    
    return null;
}

/**
 * Slug'a göre standart kategori bulur
 */
export function findStandardCategoryBySlug(slug: string): { category: StandardCategory; subcategory?: StandardSubcategory } | null {
    const normalizedSlug = slug.trim().toLowerCase();
    
    for (const category of STANDARD_CATEGORIES) {
        if (category.slug === normalizedSlug) {
            return { category };
        }
        for (const subcategory of category.subcategories) {
            if (subcategory.slug === normalizedSlug) {
                return { category, subcategory };
            }
        }
    }
    
    return null;
}


