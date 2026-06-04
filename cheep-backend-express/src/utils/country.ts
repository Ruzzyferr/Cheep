import { prisma } from './prisma.client.js';

/**
 * Ülke kodu (ISO) → country.id çözümü, cache'li.
 * Yaratım yollarında country_id zorunlu; çağıran kod sağlamazsa default ülke kullanılır.
 */
const cache = new Map<string, number>();

export const DEFAULT_COUNTRY_CODE = (process.env.DEFAULT_COUNTRY_CODE || 'TR').toUpperCase();

export async function getCountryIdByCode(code?: string | null): Promise<number> {
    const normalized = (code || DEFAULT_COUNTRY_CODE).toUpperCase();
    const cached = cache.get(normalized);
    if (cached !== undefined) return cached;

    const country = await prisma.country.findUnique({ where: { code: normalized } });
    if (!country) {
        throw new Error(`Bilinmeyen ülke kodu: ${normalized} (önce countries tablosuna ekleyin)`);
    }
    cache.set(normalized, country.id);
    return country.id;
}
