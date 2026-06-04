/**
 * Faz 1 — Hepsi-bir-arada ingest consumer.
 * `raw.products.v1`'i tüketir, mevcut LLM ingest mantığını (processRawProducts) çağırır.
 * Çalıştırma: npm run consume:ingest
 */

import { runConsumer } from '../kafka/consumer.js';
import { TOPICS, GROUPS } from '../kafka/topics.js';
import type { RawProduct } from '../kafka/avro/raw-product.schema.js';
import { processRawProducts, type RawProductInput } from '../services/ingest.service.js';
import logger from '../utils/logger.js';

function toInput(r: RawProduct): RawProductInput {
    return {
        name: r.name,
        brand: r.brand ?? undefined,
        image_url: r.imageUrl ?? undefined,
        store_id: r.storeId,
        store_sku: r.storeSku,
        price: Number(r.price),
        unit: r.unit ?? undefined,
        raw_category: r.rawCategory ?? undefined,
    };
}

async function main() {
    await runConsumer<RawProduct>({
        groupId: GROUPS.INGEST,
        topic: TOPICS.RAW_PRODUCTS,
        handler: async (records) => {
            const inputs = records.map(toInput);
            const result = await processRawProducts(inputs, true);
            logger.info(`[ingest-consumer] batch işlendi: ${JSON.stringify(result.stats)}`);
        },
    });
}

main().catch((err) => {
    logger.error('[ingest-consumer] fatal:', err);
    process.exit(1);
});
