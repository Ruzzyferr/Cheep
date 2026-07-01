import { describe, it, expect, vi, beforeEach } from 'vitest';

const findOrCreateProduct = vi.fn();
vi.mock('../src/api/products/product-matcher.service.js', () => ({
  productMatcher: { findOrCreateProduct: (...a: any[]) => findOrCreateProduct(...a) },
}));

const storePriceFindUnique = vi.fn();
const storePriceUpsert = vi.fn();
const priceHistoryCreate = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    storePrice: {
      findUnique: (...a: any[]) => storePriceFindUnique(...a),
      upsert: (...a: any[]) => storePriceUpsert(...a),
    },
    priceHistory: { create: (...a: any[]) => priceHistoryCreate(...a) },
  },
}));

import { bulkUpsertStorePrices } from '../src/api/store-prices/store-prices.service.js';

beforeEach(() => {
  findOrCreateProduct.mockReset();
  storePriceFindUnique.mockReset();
  storePriceUpsert.mockReset();
  priceHistoryCreate.mockReset();
});

describe('bulkUpsertStorePrices country threading (x-country ingest isolation)', () => {
  it('threads the resolved countryId (from x-country) into findOrCreateProduct', async () => {
    findOrCreateProduct.mockResolvedValueOnce({ product: { id: 1 }, isNew: true });
    storePriceFindUnique.mockResolvedValueOnce(null); // existingByProduct lookup
    storePriceFindUnique.mockResolvedValueOnce(null); // existingBySku lookup
    storePriceUpsert.mockResolvedValueOnce({ id: 10 });

    await bulkUpsertStorePrices(
      [{ store_id: 1, store_sku: 'CH-001', price: 1.5, name: 'Migros Milch' }],
      42
    );

    expect(findOrCreateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ country_id: 42 })
    );
  });

  it('when countryId is undefined, does not force a wrong country (passes payload through)', async () => {
    findOrCreateProduct.mockResolvedValueOnce({ product: { id: 2 }, isNew: true });
    storePriceFindUnique.mockResolvedValueOnce(null);
    storePriceFindUnique.mockResolvedValueOnce(null);
    storePriceUpsert.mockResolvedValueOnce({ id: 11 });

    await bulkUpsertStorePrices([
      { store_id: 1, store_sku: 'TR-001', price: 1.5, name: 'Süt', country_id: 7 },
    ]);

    expect(findOrCreateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ country_id: 7 })
    );
  });
});
