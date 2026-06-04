/**
 * Faz 2 — Matcher consumer.
 * normalized.products.v1 → matched.products.v1
 * Deterministik product-matcher (fingerprint + similarity) ile ürünü bulur/oluşturur,
 * kanonik productId atar. (LLM cross-market eşleştirme all-in-one ingest yolunda.)
 * Çalıştırma: npm run consume:matcher
 */

import { runConsumer } from '../kafka/consumer.js';
import { publishBatch } from '../kafka/producer.js';
import { TOPICS, GROUPS } from '../kafka/topics.js';
import type { NormalizedProduct } from '../kafka/avro/normalized-product.schema.js';
import type { MatchedProduct } from '../kafka/avro/matched-product.schema.js';
import { productMatcher } from '../api/products/product-matcher.service.js';
import logger from '../utils/logger.js';

async function main() {
    await runConsumer<NormalizedProduct>({
        groupId: GROUPS.MATCHER,
        topic: TOPICS.NORMALIZED_PRODUCTS,
        handler: async (records) => {
            const out: Array<{ key: string; value: MatchedProduct }> = [];
            for (const n of records) {
                const { product } = await productMatcher.findOrCreateProduct({
                    name: n.normalizedName,
                    brand: n.normalizedBrand ?? undefined,
                    unit: n.unit ?? undefined,
                    category_id: n.categoryId ?? undefined,
                    image_url: n.imageUrl ?? undefined,
                });

                const matched: MatchedProduct = {
                    eventId: n.eventId,
                    countryCode: n.countryCode,
                    storeId: n.storeId,
                    storeSku: n.storeSku,
                    productId: product.id,
                    muadilGrupId: product.muadil_grup_id ?? null,
                    confidence: 1.0,
                    price: n.price,
                    unit: n.unit,
                    scrapedAt: n.scrapedAt,
                };
                out.push({ key: matched.countryCode, value: matched });
            }
            await publishBatch(TOPICS.MATCHED_PRODUCTS, out);
            logger.info(`[matcher] ${out.length} kayıt matched.products.v1'e üretildi`);
        },
    });
}

main().catch((err) => {
    logger.error('[matcher] fatal:', err);
    process.exit(1);
});
