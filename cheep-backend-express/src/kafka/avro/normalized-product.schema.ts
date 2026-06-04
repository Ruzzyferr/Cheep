export const normalizedProductSchema = {
    type: 'record',
    name: 'NormalizedProduct',
    namespace: 'cheep.ingest',
    fields: [
        { name: 'eventId', type: 'string' },
        { name: 'countryCode', type: 'string' },
        { name: 'storeId', type: 'int' },
        { name: 'storeSku', type: 'string' },
        { name: 'normalizedName', type: 'string' },
        { name: 'normalizedBrand', type: ['null', 'string'], default: null },
        { name: 'size', type: ['null', 'string'], default: null },
        { name: 'categoryId', type: ['null', 'int'], default: null },
        { name: 'price', type: 'string' },
        { name: 'unit', type: ['null', 'string'], default: null },
        { name: 'imageUrl', type: ['null', 'string'], default: null },
        { name: 'scrapedAt', type: 'string' },
    ],
} as const;

export interface NormalizedProduct {
    eventId: string;
    countryCode: string;
    storeId: number;
    storeSku: string;
    normalizedName: string;
    normalizedBrand: string | null;
    size: string | null;
    categoryId: number | null;
    price: string;
    unit: string | null;
    imageUrl: string | null;
    scrapedAt: string;
}
