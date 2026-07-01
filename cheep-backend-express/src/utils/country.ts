import { prisma } from './prisma.client.js';

/**
 * Ülke kodu (ISO) → country çözümü (id + code + currency), cache'li.
 * Yaratım yollarında country_id zorunlu; çağıran kod sağlamazsa default ülke kullanılır.
 */
export interface ResolvedCountry { id: number; code: string; currency: string; }

const cache = new Map<string, ResolvedCountry>();

export const DEFAULT_COUNTRY_CODE = (process.env.DEFAULT_COUNTRY_CODE || 'TR').toUpperCase();

/** Test yardımcı — cache'i temizler. */
export function __clearCountryCache() { cache.clear(); }

export async function getCountryByCode(code?: string | null): Promise<ResolvedCountry> {
    const normalized = (code || DEFAULT_COUNTRY_CODE).toUpperCase();
    const cached = cache.get(normalized);
    if (cached !== undefined) return cached;

    const country = await prisma.country.findUnique({ where: { code: normalized } });
    if (!country) {
        throw new Error(`Bilinmeyen ülke kodu: ${normalized} (önce countries tablosuna ekleyin)`);
    }
    const resolved: ResolvedCountry = { id: country.id, code: country.code, currency: country.currency };
    cache.set(normalized, resolved);
    return resolved;
}

export async function getCountryIdByCode(code?: string | null): Promise<number> {
    return (await getCountryByCode(code)).id;
}
