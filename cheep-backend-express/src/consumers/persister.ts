/**
 * Faz 2 — Persister consumer.
 * matched.products.v1 → Postgres (StorePrice upsert + PriceHistory) → price.events.v1
 * Idempotent: (store_id, store_sku) upsert; fiyat değişince geçmiş + price event yazılır.
 * Çalıştırma: npm run consume:persister
 */

import { runConsumer } from '../kafka/consumer.js';
import { publish } from '../kafka/producer.js';
import { TOPICS, GROUPS } from '../kafka/topics.js';
import type { MatchedProduct } from '../kafka/avro/matched-product.schema.js';
import type { PriceEvent } from '../kafka/avro/price-event.schema.js';
import { prisma } from '../utils/prisma.client.js';
import { Decimal } from '@prisma/client/runtime/library';
import logger from '../utils/logger.js';

async function persistOne(m: MatchedProduct): Promise<void> {
    const newPrice = new Decimal(m.price);

    // Fiyat + geçmiş tek transaction'da atomik yazılır. oldPrice/priceChanged
    // transaction İÇİNDE okunarak read-then-write yarışı engellenir.
    const { priceChanged, oldPrice } = await prisma.$transaction(async (tx) => {
        const existing = await tx.storePrice.findUnique({
            where: { store_id_store_sku: { store_id: m.storeId, store_sku: m.storeSku } },
        });
        const old = existing ? existing.price : null;
        const changed = !existing || !existing.price.equals(newPrice);

        await tx.storePrice.upsert({
            where: { store_id_store_sku: { store_id: m.storeId, store_sku: m.storeSku } },
            create: {
                store_id: m.storeId,
                product_id: m.productId,
                store_sku: m.storeSku,
                price: newPrice,
                unit: m.unit ?? 'adet',
                source: 'kafka',
                confidence_score: m.confidence,
            },
            update: {
                product_id: m.productId,
                price: newPrice,
                unit: m.unit ?? undefined,
                last_updated_at: new Date(),
            },
        });

        if (changed) {
            await tx.priceHistory.create({
                data: { store_id: m.storeId, product_id: m.productId, price: newPrice },
            });
        }

        return { priceChanged: changed, oldPrice: old };
    });

    // at-least-once: publish transaction COMMIT'inden SONRA yapılır.
    if (priceChanged) {
        const event: PriceEvent = {
            productId: m.productId,
            storeId: m.storeId,
            countryCode: m.countryCode,
            oldPrice: oldPrice ? oldPrice.toString() : null,
            newPrice: m.price,
            changedAt: new Date().toISOString(),
        };
        await publish(TOPICS.PRICE_EVENTS, String(m.productId), event);
    }
}

async function main() {
    await runConsumer<MatchedProduct>({
        groupId: GROUPS.PERSISTER,
        topic: TOPICS.MATCHED_PRODUCTS,
        handler: async (records) => {
            let changed = 0;
            for (const m of records) {
                await persistOne(m);
                changed++;
            }
            logger.info(`[persister] ${changed} kayıt Postgres'e işlendi`);
        },
    });
}

main().catch((err) => {
    logger.error('[persister] fatal:', err);
    process.exit(1);
});
