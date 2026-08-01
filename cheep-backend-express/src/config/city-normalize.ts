/**
 * Şube adreslerindeki şehir alanını normalize eder.
 *
 * SORUN: `store_branches.city` scrape ve OSM kaynaklı, tek biçimli değil.
 * Gerçek veriden örnekler:
 *   - İlçe/il birlikte: "Keçiören/Ankara", "Merkezefendi/Denizli"
 *   - Tamamı büyük: "ADANA", "GÜMÜŞHANE", "KOCAELİ"
 *   - Aksansız ASCII: "Istanbul", "Izmir", "Isparta", "Iğdır"
 *   - Küçük harf: "istanbul"
 *
 * SEO tarafında bu ikili zarar veriyordu: Ankara altı ayrı sayfaya bölünmüştü
 * (Ankara 30 + Keçiören 36 + Çankaya 15 + …), hiçbiri "Ankara market" sorgusu
 * için yeterince güçlü değildi. Ayrıca "İstanbul" ve "istanbul" AYNI sorgu
 * için birbiriyle yarışan iki sayfaydı.
 *
 * NEDEN HARF DÖNÜŞÜMÜ YETMİYOR: Türkçe'de ASCII 'I' iki farklı harfe karşılık
 * gelebiliyor — "Istanbul" aslında "İstanbul" ama "Isparta" gerçekten 'I' ile
 * başlıyor ve "Iğdır" da öyle. Kural tabanlı dönüşüm bunlardan birini mutlaka
 * bozar. Bu yüzden 81 ilin kanonik listesiyle eşleştiriyoruz: aksansız,
 * büyük/küçük harf farkı gözetmeyen bir anahtar üretip tabloda arıyoruz.
 * Listede olmayan değer (ilçe adı, yurt dışı, bozuk kayıt) olduğu gibi
 * düzeltilmiş biçimde geçiyor — sayfa kaybolmasın.
 */

/** Türkiye'nin 81 ili, doğru yazımlarıyla. */
const TR_PROVINCES = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
    'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
    'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
    'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
    'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
    'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale',
    'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
    'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye',
    'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak',
    'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

/** Aksansız, küçük harfli, yalnızca harf-rakam içeren arama anahtarı. */
function foldKey(input: string): string {
    const map: Record<string, string> = {
        ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u',
        Ç: 'c', Ğ: 'g', I: 'i', Ö: 'o', Ş: 's', Ü: 'u', â: 'a', Â: 'a',
    };
    return Array.from(input)
        .map((ch) => map[ch] ?? ch)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

const PROVINCE_BY_KEY = new Map(TR_PROVINCES.map((name) => [foldKey(name), name]));

/** Türkçe'ye duyarlı baş harf büyütme (listede bulunamayan adlar için). */
function titleCase(word: string): string {
    if (!word) return word;
    const first = word[0];
    const upper = first === 'i' ? 'İ' : first === 'ı' ? 'I' : first.toLocaleUpperCase('tr-TR');
    return upper + word.slice(1).toLocaleLowerCase('tr-TR');
}

/**
 * "Keçiören/Ankara" → "Ankara", "ISTANBUL" → "İstanbul", "izmir" → "İzmir".
 *
 * Eğik çizgi varsa SON parça il kabul edilir: kaynak veride biçim daima
 * "ilçe/il" yönünde. Boş veya anlamsız değerler `null` döner.
 */
export function normalizeCity(raw: string | null | undefined, countryCode = 'TR'): string | null {
    if (!raw) return null;

    const lastSegment = raw.split('/').pop() ?? raw;
    const cleaned = lastSegment.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) return null;

    if (countryCode === 'TR') {
        const canonical = PROVINCE_BY_KEY.get(foldKey(cleaned));
        if (canonical) return canonical;
    }

    // Listede yok (ilçe, yurt dışı, yeni kayıt) — en azından biçimi düzelt.
    return cleaned.split(' ').map(titleCase).join(' ');
}
