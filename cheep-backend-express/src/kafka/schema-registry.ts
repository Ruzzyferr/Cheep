import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import { TOPICS } from './topics.js';
import { rawProductSchema } from './avro/raw-product.schema.js';
import { normalizedProductSchema } from './avro/normalized-product.schema.js';
import { matchedProductSchema } from './avro/matched-product.schema.js';
import { priceEventSchema } from './avro/price-event.schema.js';

export const registry = new SchemaRegistry({
    host: process.env.SCHEMA_REGISTRY_URL || 'http://localhost:8081',
});

// Her topic'in value şeması (Avro). registerAll() ile registry'ye yazılır.
const TOPIC_SCHEMAS: Record<string, object> = {
    [TOPICS.RAW_PRODUCTS]: rawProductSchema,
    [TOPICS.NORMALIZED_PRODUCTS]: normalizedProductSchema,
    [TOPICS.MATCHED_PRODUCTS]: matchedProductSchema,
    [TOPICS.PRICE_EVENTS]: priceEventSchema,
};

const idCache = new Map<string, number>();

/** Bir topic'in value şemasını registry'ye kaydeder (subject: `<topic>-value`) ve schema id döner. */
export async function registerSchema(topic: string): Promise<number> {
    if (idCache.has(topic)) return idCache.get(topic)!;
    const schema = TOPIC_SCHEMAS[topic];
    if (!schema) throw new Error(`Bilinmeyen topic için şema yok: ${topic}`);
    const { id } = await registry.register(
        { type: SchemaType.AVRO, schema: JSON.stringify(schema) },
        { subject: `${topic}-value` }
    );
    idCache.set(topic, id);
    return id;
}

/** Tüm pipeline topic'lerinin şemalarını kaydeder (idempotent). */
export async function registerAll(): Promise<void> {
    for (const topic of Object.keys(TOPIC_SCHEMAS)) {
        await registerSchema(topic);
    }
}
