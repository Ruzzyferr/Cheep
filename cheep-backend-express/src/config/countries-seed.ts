import type { PrismaClient } from '@prisma/client';
import { STANDARD_CATEGORIES } from './standard-categories.js';

/**
 * ÜLKE / MARKET / KATEGORİ tohumlaması — tek kaynak.
 *
 * NEDEN `prisma/seed.ts`'ten AYRI: `seed.ts` geliştirme tohumlaması ve içinde
 * test kullanıcısı, UYDURMA EAN'lı sahte ürünler ve örnek bir liste var.
 * Onu üretimde çalıştırmak Türk kataloğuna sahte ürün enjekte eder (bir kez
 * yaşandı: sahte "Łaciate" ürünü prod'a girip elle silinmek zorunda kaldı).
 *
 * Bu modül yalnızca REFERANS VERİYİ kuruyor — ülkeler, market satırları ve
 * kategori ağaçları. Hepsi upsert, yani tekrar çalıştırmak güvenli.
 * `seed.ts` de buradan çağırıyor; iki yerde ayrı listeler tutulsaydı
 * kaçınılmaz olarak ayrışırlardı.
 */

export interface CountrySeed {
    code: string;
    /** Ülke adı KENDİ DİLİNDE (mevcut kayıtların izlediği kural). */
    name: string;
    currency: string;
}

export interface StoreSeed {
    id: number;
    name: string;
    countryCode: string;
    /** Zincirin referans konumu — şube verisi gelene kadar kaba bir çapa. */
    address: string;
    lat?: number;
    lon?: number;
}

export const COUNTRIES: CountrySeed[] = [
    { code: 'TR', name: 'Türkiye', currency: 'TRY' },
    { code: 'CH', name: 'Schweiz', currency: 'CHF' },
    { code: 'SE', name: 'Sverige', currency: 'SEK' },
    { code: 'DE', name: 'Deutschland', currency: 'EUR' },
    { code: 'PL', name: 'Polska', currency: 'PLN' },
    // Hırvatistan 2023'te euro'ya geçti — kuna (HRK) ARTIK KULLANILMIYOR.
    { code: 'HR', name: 'Hrvatska', currency: 'EUR' },
    { code: 'HU', name: 'Magyarország', currency: 'HUF' },
    { code: 'RO', name: 'România', currency: 'RON' },
];

/**
 * ⚠️ `id` değerleri `Cheep-Scraper/countries/<ülke>/config.json` içindeki
 * `store_id`'lerle BİREBİR aynı olmak zorunda. Uyuşmazlık, fiyatları yanlış
 * zincire yazar ve bunu hiçbir şey söylemez.
 *
 * Blok düzeni: TR 1-7 · CH 10-11 · SE 20-21 · DE 30-31 · PL 40-47
 *              HR 50-57 · HU 60-67 · RO 70-79
 */
export const STORES: StoreSeed[] = [
    // Hırvatistan — countries/croatia/config.json
    { id: 50, name: 'Konzum', countryCode: 'HR', address: 'Zagreb', lat: 45.8150, lon: 15.9819 },
    { id: 51, name: 'Lidl', countryCode: 'HR', address: 'Zagreb', lat: 45.8150, lon: 15.9819 },
    { id: 52, name: 'Spar', countryCode: 'HR', address: 'Zagreb', lat: 45.8150, lon: 15.9819 },
    { id: 53, name: 'Plodine', countryCode: 'HR', address: 'Zagreb', lat: 45.8150, lon: 15.9819 },
    { id: 54, name: 'Kaufland', countryCode: 'HR', address: 'Zagreb', lat: 45.8150, lon: 15.9819 },
    { id: 55, name: 'Tommy', countryCode: 'HR', address: 'Split', lat: 43.5397, lon: 16.4979 },
    // Macaristan — countries/hungary/config.json
    { id: 60, name: 'Auchan', countryCode: 'HU', address: 'Budapest', lat: 47.4979, lon: 19.0402 },
    { id: 61, name: 'Tesco', countryCode: 'HU', address: 'Budapest', lat: 47.4979, lon: 19.0402 },
    { id: 62, name: 'Lidl', countryCode: 'HU', address: 'Budapest', lat: 47.4979, lon: 19.0402 },
    { id: 63, name: 'Aldi', countryCode: 'HU', address: 'Budapest', lat: 47.4979, lon: 19.0402 },
    { id: 64, name: 'Penny', countryCode: 'HU', address: 'Budapest', lat: 47.4979, lon: 19.0402 },
    // Romanya — countries/romania/config.json
    { id: 70, name: 'Auchan', countryCode: 'RO', address: 'București', lat: 44.4268, lon: 26.1025 },
    { id: 71, name: 'Carrefour', countryCode: 'RO', address: 'București', lat: 44.4268, lon: 26.1025 },
    { id: 72, name: 'Kaufland', countryCode: 'RO', address: 'București', lat: 44.4268, lon: 26.1025 },
    { id: 73, name: 'Lidl', countryCode: 'RO', address: 'București', lat: 44.4268, lon: 26.1025 },
    { id: 74, name: 'Mega Image', countryCode: 'RO', address: 'Cluj-Napoca', lat: 46.7712, lon: 23.6236 },
    { id: 75, name: 'Penny', countryCode: 'RO', address: 'București', lat: 44.4268, lon: 26.1025 },
];

/**
 * Kategori ağacı KURULAN ülkeler.
 *
 * TÜRKİYE BİLEREK DIŞARIDA: TR taksonomisi devletin verisinden türetilir
 * (Cheep-Scraper/countries/turkey/mf_taxonomy.py → mf_seed_categories.py).
 * Elle tutulan bu listeyi TR'ye de basmak bir kez ikiz kategorilere ve içi
 * boşaltılmış ölü kabuklara yol açmıştı.
 *
 * DE/CH/SE de dışarıda: canlı değiller ve kataloğu olmayan ülkeye kategori
 * ağacı kurmak, uygulamada ürünsüz kategori listeleri üretir.
 */
export const CATEGORY_TREE_COUNTRIES = ['PL', 'HR', 'HU', 'RO'] as const;

export interface SeedReport {
    countries: number;
    stores: number;
    categoriesByCountry: Record<string, number>;
}

/** Ülke + market satırlarını upsert eder (idempotent). */
export async function seedCountriesAndStores(
    prisma: PrismaClient,
    stores: StoreSeed[] = STORES,
): Promise<{ countries: number; stores: number; idByCode: Map<string, number> }> {
    const idByCode = new Map<string, number>();
    for (const c of COUNTRIES) {
        const row = await prisma.country.upsert({
            where: { code: c.code },
            update: {},
            create: { code: c.code, name: c.name, currency: c.currency },
        });
        idByCode.set(c.code, row.id);
    }

    for (const s of stores) {
        const countryId = idByCode.get(s.countryCode);
        if (countryId === undefined) {
            throw new Error(`${s.name} (#${s.id}): bilinmeyen ülke ${s.countryCode}`);
        }
        await prisma.store.upsert({
            where: { id: s.id },
            // Konum GÜNCELLENİYOR ama ad değil: ad elle düzeltilmiş olabilir
            // (ör. yerelleştirme), konum ise bu dosyanın sorumluluğunda.
            update: s.lat !== undefined ? { lat: s.lat, lon: s.lon } : {},
            create: {
                id: s.id, name: s.name, logo_url: null, address: s.address,
                lat: s.lat ?? null, lon: s.lon ?? null, country_id: countryId,
            },
        });
    }

    return { countries: COUNTRIES.length, stores: stores.length, idByCode };
}

/**
 * Bir ülkenin kategori ağacını kurar (idempotent). Kategoriler ülkeye
 * kapsamlı olduğundan her ülkenin kendi ağacı olmak ZORUNDA — ağacı
 * kurulmayan ülkenin tüm ürünleri kategorisiz kalır ve hiçbir listede
 * görünmez.
 */
export async function seedCategoryTree(
    prisma: PrismaClient,
    countryId: number,
): Promise<Map<string, number>> {
    const slugToId = new Map<string, number>();

    for (const parent of STANDARD_CATEGORIES) {
        const parentRow = await prisma.category.upsert({
            where: { country_id_slug: { country_id: countryId, slug: parent.slug } },
            update: {
                name: parent.name,
                display_order: parent.displayOrder,
                icon_url: parent.icon || null,
            },
            create: {
                name: parent.name, slug: parent.slug, country_id: countryId,
                parent_id: null, display_order: parent.displayOrder,
                icon_url: parent.icon || null,
            },
        });
        slugToId.set(parent.slug, parentRow.id);

        for (const sub of parent.subcategories) {
            const subRow = await prisma.category.upsert({
                where: { country_id_slug: { country_id: countryId, slug: sub.slug } },
                update: {
                    name: sub.name, parent_id: parentRow.id, display_order: sub.displayOrder,
                },
                create: {
                    name: sub.name, slug: sub.slug, country_id: countryId,
                    parent_id: parentRow.id, display_order: sub.displayOrder,
                },
            });
            slugToId.set(sub.slug, subRow.id);
        }
    }

    return slugToId;
}
