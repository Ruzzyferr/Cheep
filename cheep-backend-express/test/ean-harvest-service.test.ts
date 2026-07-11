import { describe, it, expect, vi, beforeEach } from 'vitest';

// ean-harvest.service imports prisma + productMatcher; mock both so harvestEan's
// orchestration (index build -> plan -> strict guard -> apply/merge) can be
// exercised end-to-end without a DB.
const prismaMock = {
  product: { findMany: vi.fn(), update: vi.fn() },
  country: { findUnique: vi.fn() },
};
const mergeMock = vi.fn(async () => ({ success: true }));
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/api/products/product-matcher.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/products/product-matcher.service.js')>();
  return { ...actual, productMatcher: { mergeProducts: mergeMock } };
});

const { harvestEan } = await import('../src/services/ean-harvest.service.js');

function prod(over: Partial<any>): any {
  return { id: 0, name: '', brand: null, ean_barcode: null, store_prices: [], ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.country.findUnique.mockResolvedValue({ id: 1, code: 'PL' });
});

describe('harvestEan: strict mode', () => {
  it('assigns for a word-order-only match (same significant tokens)', async () => {
    const source = prod({
      id: 1,
      name: 'Prymat Przyprawa grill klasyczny 80 g',
      brand: null,
      ean_barcode: '5900000000080',
      store_prices: [{ store_id: 40 }],
    });
    const noEan = prod({
      id: 2,
      name: 'Przyprawa Grill klasyczny Prymat 80 g',
      brand: 'Prymat',
      store_prices: [{ store_id: 41 }],
    });
    prismaMock.product.findMany.mockResolvedValue([source, noEan]);

    const stats = await harvestEan('PL', { apply: true, strict: true });

    expect(stats.candidates).toBe(1);
    expect(stats.rejectedByStrict).toBe(0);
    expect(stats.ambiguous).toBe(0);
    expect(stats.merged + stats.assigned).toBe(1);
    expect(mergeMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT assign for a promo-pack/variant mismatch even though brand+fingerprint+gramaj matched (rejectedByStrict increments)', async () => {
    // "330 g" for both -> same gramaj/fingerprint key under the OLD guard, but
    // the borrow-from name is a 330g+30g promo pack (360g total) -- a real
    // audited-wrong case. strictNameMatch must reject it.
    const source = prod({
      id: 1,
      name: 'Śmietana 12% Zott 330 g',
      brand: null,
      ean_barcode: '5900000000330',
      store_prices: [{ store_id: 40 }],
    });
    // NOTE: extractGramaj takes the FIRST size match in the string ("330g"),
    // and cleanProductText strips ALL digit+unit sequences before hashing, so
    // computeKey's (brand+fingerprint+gramaj) key for this promo-pack name
    // collides with the plain 330g product -- this IS the real audited-wrong
    // bug. strictNameMatch is the guard that catches what the key misses.
    const noEan = prod({
      id: 2,
      name: 'Smietana 12% 330g + 30g Zott 330 g',
      brand: 'Zott',
      store_prices: [{ store_id: 41 }],
    });
    prismaMock.product.findMany.mockResolvedValue([source, noEan]);

    const stats = await harvestEan('PL', { apply: true, strict: true });

    expect(stats.rejectedByStrict).toBe(1);
    expect(stats.assigned).toBe(0);
    expect(stats.merged).toBe(0);
    expect(mergeMock).not.toHaveBeenCalled();
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  it('ambiguous key assigns nothing (never reaches the strict guard)', async () => {
    const source1 = prod({
      id: 1,
      name: 'Mleko UHT Łaciate 3,2% 1L',
      brand: null,
      ean_barcode: '5900000000001',
      store_prices: [{ store_id: 40 }],
    });
    const source2 = prod({
      id: 3,
      name: 'Mleko UHT Łaciate 3,2% 1L',
      brand: null,
      ean_barcode: '5900000000999',
      store_prices: [{ store_id: 47 }],
    });
    const noEan = prod({
      id: 2,
      name: 'Łaciate Mleko UHT 3,2% 1L',
      brand: 'Łaciate',
      store_prices: [{ store_id: 41 }],
    });
    prismaMock.product.findMany.mockResolvedValue([source1, source2, noEan]);

    const stats = await harvestEan('PL', { apply: true, strict: true });

    expect(stats.ambiguous).toBe(1);
    expect(stats.assigned).toBe(0);
    expect(stats.merged).toBe(0);
    expect(stats.rejectedByStrict).toBe(0);
    expect(mergeMock).not.toHaveBeenCalled();
  });

  it('dry-run (apply: false) performs no writes even on a valid strict match', async () => {
    const source = prod({
      id: 1,
      name: 'Prymat Przyprawa grill klasyczny 80 g',
      brand: null,
      ean_barcode: '5900000000080',
      store_prices: [{ store_id: 40 }],
    });
    const noEan = prod({
      id: 2,
      name: 'Przyprawa Grill klasyczny Prymat 80 g',
      brand: 'Prymat',
      store_prices: [{ store_id: 41 }],
    });
    prismaMock.product.findMany.mockResolvedValue([source, noEan]);

    const stats = await harvestEan('PL', { apply: false, strict: true });

    expect(stats.merged + stats.assigned).toBe(1); // still counted in the plan
    expect(mergeMock).not.toHaveBeenCalled();
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  it('throws for an unknown country code', async () => {
    prismaMock.country.findUnique.mockResolvedValue(null);
    await expect(harvestEan('ZZ', { apply: true, strict: true })).rejects.toThrow(/Unknown country code/);
  });
});
