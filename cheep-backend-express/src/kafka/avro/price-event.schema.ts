export const priceEventSchema = {
    type: 'record',
    name: 'PriceEvent',
    namespace: 'cheep.ingest',
    fields: [
        { name: 'productId', type: 'int' },
        { name: 'storeId', type: 'int' },
        { name: 'countryCode', type: 'string' },
        { name: 'oldPrice', type: ['null', 'string'], default: null },
        { name: 'newPrice', type: 'string' },
        { name: 'changedAt', type: 'string' },
    ],
} as const;

export interface PriceEvent {
    productId: number;
    storeId: number;
    countryCode: string;
    oldPrice: string | null;
    newPrice: string;
    changedAt: string;
}
