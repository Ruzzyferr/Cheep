export const rawProductSchema = {
    type: 'record',
    name: 'RawProduct',
    namespace: 'cheep.ingest',
    fields: [
        { name: 'eventId', type: 'string' },
        { name: 'countryCode', type: 'string' },
        { name: 'storeId', type: 'int' },
        { name: 'storeSku', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'brand', type: ['null', 'string'], default: null },
        { name: 'price', type: 'string' },
        { name: 'unit', type: ['null', 'string'], default: null },
        { name: 'rawCategory', type: ['null', 'string'], default: null },
        { name: 'imageUrl', type: ['null', 'string'], default: null },
        { name: 'scrapedAt', type: 'string' },
    ],
} as const;

export interface RawProduct {
    eventId: string;
    countryCode: string;
    storeId: number;
    storeSku: string;
    name: string;
    brand: string | null;
    price: string;
    unit: string | null;
    rawCategory: string | null;
    imageUrl: string | null;
    scrapedAt: string;
}
