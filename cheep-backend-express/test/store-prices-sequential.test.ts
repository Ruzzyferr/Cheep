import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records the ORDER in which findOrCreateProduct calls start/end, so we can
// prove sequential (not concurrent) execution: 'end-1' must precede
// 'start-2'. Also emulates the fingerprint dedup that sequential execution
// enables: the second call with the same normalized name sees the product
// the first call already created (same {id:1}) instead of racing it.
const callOrder: string[] = [];
const createdByKey = new Map<string, { id: number }>();
let nextId = 1;

const findOrCreateProduct = vi.fn(async (data: { name: string }) => {
  const callNum = callOrder.filter(e => e.startsWith('start-')).length + 1;
  callOrder.push(`start-${callNum}`);

  // Simulate async DB round-trip so a concurrent (Promise.all) caller would
  // interleave here — sequential execution guarantees it never does.
  await new Promise(resolve => setTimeout(resolve, 5));

  // Fingerprint-ish key: same normalization the real service applies
  // (lowercase + collapse whitespace) so both "duplicate" rows key-match.
  const key = data.name.toLowerCase().replace(/\s+/g, ' ').trim();

  let product = createdByKey.get(key);
  let isNew = false;
  if (!product) {
    product = { id: nextId++ };
    createdByKey.set(key, product);
    isNew = true;
  }

  callOrder.push(`end-${callNum}`);
  return { product, isNew };
});

vi.mock('../src/api/products/product-matcher.service.js', () => ({
  productMatcher: { findOrCreateProduct: (...a: any[]) => findOrCreateProduct(...a) },
}));

// In-memory store_prices keyed by `${store_id}:${product_id}` so the second
// duplicate row (same resolved product_id, different store_sku) takes the
// existingByProduct UPDATE path instead of erroring, just like production.
const storePricesByStoreProduct = new Map<string, { id: number; price: any }>();
let nextStorePriceId = 1;

const storePriceFindUnique = vi.fn(async ({ where }: any) => {
  if (where.store_id_product_id) {
    const { store_id, product_id } = where.store_id_product_id;
    return storePricesByStoreProduct.get(`${store_id}:${product_id}`) ?? null;
  }
  // store_id_store_sku lookup — not needed on the existingByProduct path,
  // but keep it safe for the first (create) row.
  return null;
});

const storePriceUpsert = vi.fn(async ({ create }: any) => {
  const row = { id: nextStorePriceId++, price: create.price };
  storePricesByStoreProduct.set(`${create.store_id}:${create.product_id}`, row);
  return row;
});

const storePriceUpdate = vi.fn(async ({ where, data }: any) => {
  // Find the existing row by its own id (assigned in existingByProduct) and
  // apply the patch, mirroring prisma's update-by-id semantics.
  for (const [key, row] of storePricesByStoreProduct.entries()) {
    if (row.id === where.id) {
      const updated = { ...row, ...data };
      storePricesByStoreProduct.set(key, updated);
      return updated;
    }
  }
  throw new Error(`storePrice.update: no row with id ${where.id}`);
});

const priceHistoryCreate = vi.fn(async () => ({}));

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    storePrice: {
      findUnique: (...a: any[]) => storePriceFindUnique(...a),
      upsert: (...a: any[]) => storePriceUpsert(...a),
      update: (...a: any[]) => storePriceUpdate(...a),
    },
    priceHistory: { create: (...a: any[]) => priceHistoryCreate(...a) },
  },
}));

import { bulkUpsertStorePrices } from '../src/api/store-prices/store-prices.service.js';

beforeEach(() => {
  callOrder.length = 0;
  createdByKey.clear();
  nextId = 1;
  storePricesByStoreProduct.clear();
  nextStorePriceId = 1;
  findOrCreateProduct.mockClear();
  storePriceFindUnique.mockClear();
  storePriceUpsert.mockClear();
  storePriceUpdate.mockClear();
  priceHistoryCreate.mockClear();
});

describe('bulkUpsertStorePrices sequential processing (fingerprint race fix)', () => {
  it('dedups same-fingerprint duplicate rows in one chunk (2 successful, 0 failed)', async () => {
    const result = await bulkUpsertStorePrices([
      { store_id: 41, store_sku: 'AUCHAN-SKU-1', price: 12.99, name: 'Mleko UHT 3,2% Auchan 1l' },
      { store_id: 41, store_sku: 'AUCHAN-SKU-2', price: 12.99, name: 'Mleko UHT 3,2% Auchan 1l' },
    ]);

    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);

    // Both rows resolved to the SAME product — no duplicate product created.
    expect(createdByKey.size).toBe(1);
    expect(findOrCreateProduct).toHaveBeenCalledTimes(2);
  });

  it('processes findOrCreateProduct calls sequentially, not concurrently', async () => {
    await bulkUpsertStorePrices([
      { store_id: 41, store_sku: 'AUCHAN-SKU-1', price: 12.99, name: 'Mleko UHT 3,2% Auchan 1l' },
      { store_id: 41, store_sku: 'AUCHAN-SKU-2', price: 12.99, name: 'Mleko UHT 3,2% Auchan 1l' },
    ]);

    // If calls ran concurrently (Promise.all/allSettled), 'start-2' would be
    // logged before 'end-1' resolves. Sequential execution guarantees the
    // first call fully resolves before the second one starts.
    const end1 = callOrder.indexOf('end-1');
    const start2 = callOrder.indexOf('start-2');
    expect(end1).toBeGreaterThan(-1);
    expect(start2).toBeGreaterThan(-1);
    expect(end1).toBeLessThan(start2);
    expect(callOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });
});
