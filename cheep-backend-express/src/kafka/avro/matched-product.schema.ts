export const matchedProductSchema = {
    type: 'record',
    name: 'MatchedProduct',
    namespace: 'cheep.ingest',
    fields: [
        { name: 'eventId', type: 'string' },
        { name: 'countryCode', type: 'string' },
        { name: 'storeId', type: 'int' },
        { name: 'storeSku', type: 'string' },
        { name: 'productId', type: 'int' },
        { name: 'muadilGrupId', type: ['null', 'string'], default: null },
        { name: 'confidence', type: 'double', default: 1.0 },
        { name: 'price', type: 'string' },
        { name: 'unit', type: ['null', 'string'], default: null },
        { name: 'scrapedAt', type: 'string' },
    ],
} as const;

export interface MatchedProduct {
    eventId: string;
    countryCode: string;
    storeId: number;
    storeSku: string;
    productId: number;
    muadilGrupId: string | null;
    confidence: number;
    price: string;
    unit: string | null;
    scrapedAt: string;
}
