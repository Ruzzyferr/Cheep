/**
 * URL slug üretimi — Türkçe ve Lehçe karakterleri doğru sadeleştirir.
 *
 * Slug'lar SEO sayfalarının kalıcı adresleridir: bir kez üretilip veritabanında
 * saklanırlar. Ürün adı sonradan düzelse bile slug DEĞİŞMEZ — değişseydi
 * indekslenmiş her URL ölür, Google'da biriken sıralama sıfırlanırdı.
 *
 * Neden hazır bir kütüphane değil: `slugify` gibi paketler Türkçe 'ı' ve Lehçe
 * 'ł' harflerini ya düşürüyor ya yanlış eşliyor ("ısıtıcı" → "stc"). Ürün
 * adlarının tamamı bu iki dilde olduğu için doğru eşleme pazarlık konusu değil.
 */

/** Latin-1 dışı harflerin ASCII karşılıkları. */
const CHAR_MAP: Record<string, string> = {
    // Türkçe
    ç: 'c', Ç: 'c',
    ğ: 'g', Ğ: 'g',
    ı: 'i', I: 'i', İ: 'i', i: 'i',
    ö: 'o', Ö: 'o',
    ş: 's', Ş: 's',
    ü: 'u', Ü: 'u',
    // Lehçe
    ą: 'a', Ą: 'a',
    ć: 'c', Ć: 'c',
    ę: 'e', Ę: 'e',
    ł: 'l', Ł: 'l',
    ń: 'n', Ń: 'n',
    ó: 'o', Ó: 'o',
    ś: 's', Ś: 's',
    ź: 'z', Ź: 'z',
    ż: 'z', Ż: 'z',
    // Sık rastlanan diğerleri (marka adlarında geçiyor)
    ä: 'a', Ä: 'a', å: 'a', Å: 'a', á: 'a', à: 'a', â: 'a',
    é: 'e', É: 'e', è: 'e', ê: 'e',
    í: 'i', ï: 'i',
    ñ: 'n', Ñ: 'n',
    ô: 'o', õ: 'o', ø: 'o', Ø: 'o',
    ú: 'u', û: 'u',
    ß: 'ss',
    '&': '-ve-',
    '%': '-yuzde-',
};

/** Slug'ın makul uzunluk sınırı — uzun URL'ler hem çirkin hem kırılgan. */
const MAX_LENGTH = 80;

/**
 * Metni URL-güvenli bir slug'a çevirir.
 *
 * @example
 * slugify('Ülker Çikolatalı Gofret 36 g')  // 'ulker-cikolatali-gofret-36-g'
 * slugify('Mleko UHT 3,2% Łaciate 1 l')    // 'mleko-uht-3-2-yuzde-laciate-1-l'
 */
export function slugify(input: string): string {
    if (!input) return '';

    const folded = Array.from(input)
        .map((ch) => CHAR_MAP[ch] ?? ch)
        .join('');

    return folded
        .toLowerCase()
        // Unicode normalizasyonu kalan aksanları (é → e) ayıklar.
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        // Harf ve rakam dışındaki her şey ayraç olur.
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, MAX_LENGTH)
        // Kesme işlemi sonda tire bırakmış olabilir.
        .replace(/-$/, '');
}

/**
 * Ürün slug'ı: marka + isim. Marka isimde zaten geçiyorsa tekrarlanmaz
 * ("Ülker Ülker Çikolata" gibi çirkinlikler oluşmasın).
 */
export function productSlug(name: string, brand?: string | null): string {
    const nameSlug = slugify(name);
    if (!brand) return nameSlug;

    const brandSlug = slugify(brand);
    if (!brandSlug || nameSlug.startsWith(`${brandSlug}-`) || nameSlug === brandSlug) {
        return nameSlug;
    }
    return slugify(`${brandSlug}-${nameSlug}`);
}

/**
 * Aynı slug'a düşen kayıtları ayırır. Çakışma nadirdir ama gerçektir
 * (farklı gramajlar aynı ada sahip olabiliyor) ve slug UNIQUE.
 *
 * @param taken Bu üretim turunda daha önce verilmiş slug'lar; fonksiyon
 *              kabul ettiği slug'ı kümeye kendisi ekler.
 */
export function uniqueSlug(base: string, id: number, taken: Set<string>): string {
    const safe = base || `urun-${id}`;
    const candidate = taken.has(safe) ? `${safe}-${id}` : safe;
    taken.add(candidate);
    return candidate;
}
