/**
 * Faz 2 — Normalizer consumer.
 * raw.products.v1 → normalized.products.v1
 * İsim/marka temizler, kategoriyi standart kategoriye eşler (categoryMatcher).
 * Çalıştırma: npm run consume:normalizer
 */

import { runConsumer } from '../kafka/consumer.js';
import { publishBatch } from '../kafka/producer.js';
import { TOPICS, GROUPS } from '../kafka/topics.js';
import type { RawProduct } from '../kafka/avro/raw-product.schema.js';
import type { NormalizedProduct } from '../kafka/avro/normalized-product.schema.js';
import { categoryMatcher } from '../api/categories/category-matcher.service.js';
import logger from '../utils/logger.js';

function cleanText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

async function resolveCategoryId(rawCategory: string | null, name: string): Promise<number | null> {
    if (!rawCategory) return null;
    try {
        return await categoryMatcher.findOrCreateCategory(rawCategory, name);
    } catch {
        // Standart kategoriye eşlenemezse kategori olmadan devam (persister null kabul eder)
        return null;
    }
}

async function main() {
    await runConsumer<RawProduct>({
        groupId: GROUPS.NORMALIZER,
        topic: TOPICS.RAW_PRODUCTS,
        handler: async (records) => {
            const out: Array<{ key: string; value: NormalizedProduct }> = [];
            for (const r of records) {
                const categoryId = await resolveCategoryId(r.rawCategory, r.name);
                const normalized: NormalizedProduct = {
                    eventId: r.eventId,
                    countryCode: r.countryCode,
                    storeId: r.storeId,
                    storeSku: r.storeSku,
                    normalizedName: cleanText(r.name),
                    normalizedBrand: r.brand ? cleanText(r.brand) : null,
                    size: r.unit ? cleanText(r.unit) : null,
                    categoryId,
                    price: r.price,
                    unit: r.unit,
                    imageUrl: r.imageUrl,
                    scrapedAt: r.scrapedAt,
                };
                out.push({ key: normalized.countryCode, value: normalized });
            }
            await publishBatch(TOPICS.NORMALIZED_PRODUCTS, out);
            logger.info(`[normalizer] ${out.length} kayıt normalized.products.v1'e üretildi`);
        },
    });
}

main().catch((err) => {
    logger.error('[normalizer] fatal:', err);
    process.exit(1);
});
