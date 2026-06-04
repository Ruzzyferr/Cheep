import { EachBatchPayload, KafkaMessage } from 'kafkajs';
import { kafka } from './client.js';
import { registry } from './schema-registry.js';
import { getProducer } from './producer.js';
import { dlqTopic } from './topics.js';
import logger from '../utils/logger.js';

export interface ConsumerOptions<T> {
    groupId: string;
    topic: string;
    /** Bir batch decode edilmiş kaydı işler. Hata atarsa retry → tükenirse DLQ. */
    handler: (records: T[]) => Promise<void>;
    /** Geçici hatalar için maksimum deneme (default 3). */
    maxRetries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bir mesajı dead-letter topic'ine, hata metadata'sı header'larıyla gönderir. */
async function sendToDlq(topic: string, msg: KafkaMessage, error: unknown): Promise<void> {
    const producer = await getProducer();
    await producer.send({
        topic: dlqTopic(topic),
        messages: [
            {
                key: msg.key ?? undefined,
                value: msg.value ?? null,
                headers: {
                    error: String(error instanceof Error ? error.message : error),
                    originalOffset: msg.offset,
                    failedAt: new Date().toISOString(),
                },
            },
        ],
    });
}

/**
 * Process-then-commit batch consumer:
 *  - tüm batch decode edilir, handler'a verilir
 *  - handler hata atarsa sınırlı exponential backoff ile yeniden denenir
 *  - denemeler tükenirse batch mesajları DLQ'ya gönderilir (head-of-line blocking yok)
 *  - offset'ler ancak işlem bittikten sonra resolve edilir
 */
export async function runConsumer<T>(opts: ConsumerOptions<T>): Promise<void> {
    const { groupId, topic, handler, maxRetries = 3 } = opts;
    const consumer = kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    logger.info(`[kafka] consumer ${groupId} subscribed to ${topic}`);

    await consumer.run({
        eachBatchAutoResolve: false,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }: EachBatchPayload) => {
            const decoded: T[] = [];
            for (const message of batch.messages) {
                if (message.value) {
                    decoded.push((await registry.decode(message.value)) as T);
                }
            }

            let attempt = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (!isRunning() || isStale()) return;
                try {
                    await handler(decoded);
                    break; // başarılı
                } catch (err) {
                    attempt++;
                    if (attempt > maxRetries) {
                        logger.error(
                            `[kafka] ${groupId} batch ${maxRetries} denemede başarısız → DLQ`,
                            err
                        );
                        for (const message of batch.messages) {
                            await sendToDlq(topic, message, err);
                        }
                        break; // DLQ'ya atıldı, ilerle
                    }
                    const backoff = Math.min(1000 * 2 ** (attempt - 1), 15_000);
                    logger.warn(`[kafka] ${groupId} batch hata (deneme ${attempt}), ${backoff}ms sonra retry`);
                    await sleep(backoff);
                    await heartbeat();
                }
            }

            // Process-then-commit: ancak şimdi offset'leri resolve et
            for (const message of batch.messages) {
                resolveOffset(message.offset);
            }
            await heartbeat();
        },
    });
}
