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

/** Kanonik il adları — sağlık raporu "bu bir il mi" diye buna bakıyor. */
export const TR_PROVINCE_SET = new Set(TR_PROVINCES);

const PROVINCE_BY_KEY = new Map(TR_PROVINCES.map((name) => [foldKey(name), name]));

/**
 * İl adı taşımayan yerleşim adları → bağlı oldukları il.
 *
 * NEDEN GEREKLİ: bazı şube kayıtlarında yalnızca ilçe/belde adı var, "ilçe/il"
 * biçimi yok ve `address` alanı boş. Bu adlar il listesinde bulunamayınca kendi
 * başlarına birer "şehir" sayfası açıyordu — "Büyükkarıştıran market fiyatları"
 * gibi 6 şubelik sayfalar, bağlı oldukları ilin sayfasını güçlendirmek yerine
 * ondan pay çalıyordu.
 *
 * EŞLEME KOORDİNATTAN DOĞRULANDI, ad benzerliğinden değil. Buraya yeni bir
 * satır eklerken aynısını yapın: `SELECT city, avg(lat), avg(lon) FROM
 * store_branches GROUP BY city`. Ad yanıltıcı olabiliyor — "Altınova" Yalova'nın
 * bir ilçesini çağrıştırıyor ama verideki şubeler (40.94, 27.48) Tekirdağ'da.
 *
 * Liste kısa tutuluyor: yalnızca sayfa açacak kadar (>= MIN_BRANCHES_FOR_CITY)
 * şubesi olan yerleşimler. Yeni bir tanesi çıktığında haftalık veri sağlık
 * raporu uyarır (`scripts/data-health.ts`).
 */
const TR_LOCALITY_PROVINCE: Record<string, string> = {
    // Tekirdağ
    kapakli: 'Tekirdağ',      // 41.330, 27.976 — Çerkezköy'ün kuzeyi
    altinova: 'Tekirdağ',     // 40.942, 27.485 — Süleymanpaşa; Yalova DEĞİL
    // Kırklareli
    luleburgaz: 'Kırklareli', // 41.396, 27.357
    buyukkaristiran: 'Kırklareli', // 41.300, 27.546 — Lüleburgaz'a bağlı belde
    // Aydın
    akbuk: 'Aydın',           // 37.390, 27.433 — Didim
};

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
        const key = foldKey(cleaned);
        // Önce il listesi: "Kapaklı/Tekirdağ" gibi doğru biçimli kayıtlar
        // buradan çıkar ve ilçe eşlemesine hiç uğramaz.
        const canonical = PROVINCE_BY_KEY.get(key);
        if (canonical) return canonical;

        const province = TR_LOCALITY_PROVINCE[key];
        if (province) return province;
    }

    // Listede yok (ilçe, yurt dışı, yeni kayıt) — en azından biçimi düzelt.
    return cleaned.split(' ').map(titleCase).join(' ');
}
