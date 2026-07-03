import logger from '../../utils/logger.js';
import { prisma } from '../../utils/prisma.client.js';

interface BranchInput {
    store_id: number;
    external_ref: string;
    name: string;
    lat: number;
    lon: number;
    city?: string | null;
    source?: string;
}

/**
 * Şubeleri external_ref'e göre upsert eder (ör. 'mf:bim-Q061'). Scraper her tarama
 * koşusunda çağırır; böylece store_branches sürekli tazelenir ve compare-engine'in
 * "en yakın şube" mesafesi otomatik çalışır. Ingest-key korumalı.
 *
 * country_id x-country header'ından (req.country) gelir. Geçersiz store_id'li
 * satırlar (o ülkede olmayan mağaza) sessizce atlanır — tüm chunk düşmesin.
 */
export async function bulkUpsertStoreBranches(
    branches: BranchInput[],
    countryId?: number
): Promise<{ total: number; successful: number; failed: number }> {
    if (!countryId) {
        return { total: branches.length, successful: 0, failed: branches.length };
    }

    // O ülkedeki geçerli mağaza id'leri (FK hatası yerine önceden süz)
    const validStores = new Set(
        (await prisma.store.findMany({ where: { country_id: countryId }, select: { id: true } }))
            .map(s => s.id)
    );

    let successful = 0;
    let failed = 0;
    const CHUNK = 100;

    for (let i = 0; i < branches.length; i += CHUNK) {
        const chunk = branches.slice(i, i + CHUNK);
        const results = await Promise.allSettled(
            chunk.map(b => {
                if (!validStores.has(b.store_id)) {
                    return Promise.reject(new Error(`store ${b.store_id} not in country ${countryId}`));
                }
                const data = {
                    store_id: b.store_id,
                    country_id: countryId,
                    name: b.name.slice(0, 300),
                    lat: b.lat,
                    lon: b.lon,
                    city: b.city?.slice(0, 120) || null,
                    source: (b.source || 'marketfiyati').slice(0, 40),
                };
                return prisma.storeBranch.upsert({
                    where: { external_ref: b.external_ref },
                    create: { external_ref: b.external_ref, ...data },
                    update: { ...data },
                });
            })
        );
        for (const r of results) {
            if (r.status === 'fulfilled') successful++;
            else failed++;
        }
    }

    logger.info(`[StoreBranch] bulk-upsert: total=${branches.length} ok=${successful} fail=${failed} (country=${countryId})`);
    return { total: branches.length, successful, failed };
}
