/**
 * Affiliate URL çözümleme — saf (yan etkisiz), test edilebilir.
 *
 * Mağaza adından online-market adresini üretir. URL üretimi sunucu tarafında
 * tutulur; ileride gerçek affiliate (komisyon) linklerine geçildiğinde sadece
 * burası değişir, mobil uygulama güncellenmez.
 */

// Bilinen zincirlerin online-market kök adresleri (normalize edilmiş anahtar → URL)
const STORE_URL_MAP: Record<string, string> = {
    // Türkiye
    migros: 'https://www.migros.com.tr/',
    carrefoursa: 'https://www.carrefoursa.com/',
    carrefour: 'https://www.carrefoursa.com/',
    a101: 'https://www.a101.com.tr/',
    sok: 'https://www.sokmarket.com.tr/',
    bim: 'https://www.bim.com.tr/',
    'tarim kredi': 'https://www.tarimkredi.org.tr/',
    macrocenter: 'https://www.macrocenter.com.tr/',
    // Polonya
    biedronka: 'https://www.biedronka.pl/',
    zabka: 'https://www.zabka.pl/',
    lidl: 'https://www.lidl.com.tr/',
};

/** Mağaza adını eşleştirme için sadeleştirir (Türkçe karakter → ASCII, küçük harf). */
export function normalizeStoreKey(name: string): string {
    return name
        .toLowerCase()
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Mağaza için bilinen kök adresi döndürür; tanınmıyorsa null. */
export function resolveKnownStoreUrl(storeName: string): string | null {
    const key = normalizeStoreKey(storeName);
    if (STORE_URL_MAP[key]) return STORE_URL_MAP[key];
    // Kısmî eşleşme (ör. "Migros Jet", "CarrefourSA Hiper")
    for (const mapKey of Object.keys(STORE_URL_MAP)) {
        if (key.includes(mapKey)) return STORE_URL_MAP[mapKey];
    }
    return null;
}

/** Tanınmayan mağaza için güvenli yedek: web arama bağlantısı (buton her zaman çalışsın). */
export function searchFallbackUrl(storeName: string, productName?: string | null): string {
    const q = [storeName, productName, 'online market'].filter(Boolean).join(' ');
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/**
 * Bir mağaza tıklaması için açılacak nihai URL'yi üretir. Her zaman kullanılabilir
 * bir string döner. Öncelik: DB'deki website_url > bilinen zincir > arama yedeği.
 */
export function buildStoreUrl(
    storeName: string,
    websiteUrl?: string | null,
    productName?: string | null
): string {
    if (websiteUrl && /^https?:\/\//i.test(websiteUrl)) return websiteUrl;
    return resolveKnownStoreUrl(storeName) ?? searchFallbackUrl(storeName, productName);
}
