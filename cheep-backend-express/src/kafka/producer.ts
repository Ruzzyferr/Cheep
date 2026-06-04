import { Producer } from 'kafkajs';
import { kafka } from './client.js';
import { registry, registerSchema } from './schema-registry.js';
import logger from '../utils/logger.js';

let producer: Producer | null = null;

/** Idempotent producer'ı (tek instance) başlatır. */
export async function getProducer(): Promise<Producer> {
    if (producer) return producer;
    const p = kafka.producer({ idempotent: true, maxInFlightRequests: 1 });
    await p.connect();
    producer = p;
    logger.info('[kafka] producer connected');
    return p;
}

/**
 * Bir kaydı Avro ile encode edip topic'e üretir. key = partition anahtarı (örn. countryCode).
 */
export async function publish(topic: string, key: string, value: unknown): Promise<void> {
    const p = await getProducer();
    const schemaId = await registerSchema(topic);
    const encoded = await registry.encode(schemaId, value);
    await p.send({ topic, messages: [{ key, value: encoded }] });
}

/** Toplu üretim (aynı topic). */
export async function publishBatch(
    topic: string,
    items: Array<{ key: string; value: unknown }>
): Promise<void> {
    if (items.length === 0) return;
    const p = await getProducer();
    const schemaId = await registerSchema(topic);
    const messages = await Promise.all(
        items.map(async (it) => ({ key: it.key, value: await registry.encode(schemaId, it.value) }))
    );
    await p.send({ topic, messages });
}

export async function disconnectProducer(): Promise<void> {
    if (producer) {
        await producer.disconnect();
        producer = null;
    }
}
