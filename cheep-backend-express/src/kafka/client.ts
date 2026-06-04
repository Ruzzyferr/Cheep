import { Kafka, logLevel } from 'kafkajs';

/**
 * Paylaşılan Kafka client. Broker(lar) KAFKA_BROKERS env'inden (virgülle ayrılmış).
 * Prod'da SASL/SSL eklenir.
 */
const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

export const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'cheep-backend',
    brokers,
    logLevel: logLevel.INFO,
    retry: { retries: 8 },
});
