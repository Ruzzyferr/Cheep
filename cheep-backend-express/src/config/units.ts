/**
 * Kabul edilen ÖLÇÜ BİRİMLERİ — tek kaynak.
 *
 * NEDEN TEK YERDE: bu liste eskiden ÜÇ ayrı Joi şemasında elle tekrarlanıyordu
 * (`store-price.schema.ts` bir sürüm, `list.schema.ts`'te iki sürüm daha) ve
 * üçü BİRBİRİNDEN AYRILMIŞTI: fiyat ingest'i `szt`/`opak` (Lehçe) kabul
 * ederken liste şemaları etmiyordu. Yani Polonya kataloğundan gelen `szt`
 * birimli bir ürün veritabanına giriyor ama kullanıcı onu LİSTESİNE
 * EKLEYEMİYORDU — istek 400 ile düşüyordu.
 *
 * Yeni bir ülke eklerken paket birimini BURAYA ekleyin; üç şema da otomatik
 * öğrenir ve bir daha ayrışamaz.
 *
 * Ülke karşılıkları:
 *   TR "adet" · PL "szt"/"opak" · HR "kom" (komad) · HU "db" (darab)
 *   RO "buc" (bucata)
 *
 * DİKKAT — bunlar MAKİNE değerleridir, kullanıcıya gösterilecek etiketler
 * DEĞİL. Arayüz tarafı çeviri metnini ("Stück", "szt.", "piece") ASLA bu alana
 * yazmamalı: çevrilmiş etiket bu listede yoktur ve istek 400 döner.
 */
export const ALLOWED_UNITS = [
    'adet', 'kg', 'g', 'l', 'ml', 'cl', 'paket', 'kutu',
    'szt', 'opak',   // Polonya
    'kom',           // Hırvatistan
    'db',            // Macaristan
    'buc',           // Romanya
] as const;

export type AllowedUnit = (typeof ALLOWED_UNITS)[number];

/** Joi `.valid(...)` çağrısına yayılabilir hâli. */
export const ALLOWED_UNITS_MUTABLE: string[] = [...ALLOWED_UNITS];

/**
 * Ülkenin varsayılan PAKET birimi. Bir ürünün birimi bilinmiyorken kullanılır.
 * Bilinmeyen ülke için 'adet' (şemanın da varsayılanı).
 */
export const DEFAULT_UNIT_BY_COUNTRY: Record<string, AllowedUnit> = {
    TR: 'adet',
    PL: 'szt',
    HR: 'kom',
    HU: 'db',
    RO: 'buc',
};

export function defaultUnitForCountry(countryCode?: string | null): AllowedUnit {
    return DEFAULT_UNIT_BY_COUNTRY[(countryCode ?? '').toUpperCase()] ?? 'adet';
}
