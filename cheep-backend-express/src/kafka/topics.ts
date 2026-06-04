/**
 * Kafka topic adları ve consumer group id'leri (tek kaynak).
 * `.v1` son eki ileride uyumlu şema evrimi içindir.
 */
export const TOPICS = {
    RAW_PRODUCTS: 'raw.products.v1',
    NORMALIZED_PRODUCTS: 'normalized.products.v1',
    MATCHED_PRODUCTS: 'matched.products.v1',
    PRICE_EVENTS: 'price.events.v1',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/** Bir topic için dead-letter topic adı. */
export const dlqTopic = (topic: string): string => `${topic}.dlq`;

export const GROUPS = {
    INGEST: 'cheep-ingest',
    NORMALIZER: 'cheep-normalizer',
    MATCHER: 'cheep-matcher',
    PERSISTER: 'cheep-persister',
    ALERTER: 'cheep-alerter',
} as const;
