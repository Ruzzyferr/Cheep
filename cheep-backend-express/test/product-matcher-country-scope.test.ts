import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const create = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    product: {
      findFirst: (...a: any[]) => findFirst(...a),
      create: (...a: any[]) => create(...a),
      findMany: (...a: any[]) => findMany(...a),
      update: (...a: any[]) => update(...a),
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('../src/utils/country.js', () => ({
  getCountryIdByCode: vi.fn(async (code?: string) =>
    ({ TR: 1, CH: 2, SE: 3, DE: 4, PL: 5 } as Record<string, number>)[code ?? ''] ?? undefined),
}));

import { productMatcher } from '../src/api/products/product-matcher.service.js';

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
  findMany.mockReset();
  update.mockReset();
});

describe('findOrCreateProduct fallback paths are country-scoped (no cross-country merge)', () => {
  it('no ean_barcode → fingerprint exact-match lookup carries the resolved country_id', async () => {
    findFirst.mockResolvedValue(null); // fingerprint exact-match miss (both attempts)
    findMany.mockResolvedValueOnce([]); // no fuzzy candidates
    create.mockResolvedValueOnce({ id: 21, name: 'Milch 1L', brand: 'REWE', country_id: 4 });

    await productMatcher.findOrCreateProduct({
      name: 'REWE Milch 1L', brand: 'REWE', country_code: 'DE',
    });

    expect(findFirst).toHaveBeenCalled();
    const fingerprintCall = findFirst.mock.calls.find(c => c[0]?.where?.muadil_grup_id);
    expect(fingerprintCall?.[0].where.country_id).toBe(4);
  });

  it('fuzzy-match (findMany) lookup carries the resolved country_id in its where-clause', async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValueOnce([]);
    create.mockResolvedValueOnce({ id: 22, name: 'Milch 1L', brand: 'REWE', country_id: 4 });

    await productMatcher.findOrCreateProduct({
      name: 'REWE Milch 1L', brand: 'REWE', country_code: 'DE',
    });

    expect(findMany).toHaveBeenCalled();
    const findManyCall = findMany.mock.calls[0][0];
    expect(findManyCall.where.country_id).toBe(4);
  });

  it('a fuzzy match existing only in a DIFFERENT country is excluded → creates a new product instead of merging', async () => {
    // Simulates: a TR product with a near-identical fingerprint exists, but the
    // country-scoped findMany query correctly excludes it (returns []) because
    // the incoming product is DE.
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValueOnce([]);
    create.mockResolvedValueOnce({ id: 23, name: 'Milch 1L', brand: 'REWE', country_id: 4 });

    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'REWE Milch 1L', brand: 'REWE', country_code: 'DE',
    });

    expect(isNew).toBe(true);
    expect(product.country_id).toBe(4);
    const createArg = create.mock.calls[0][0];
    expect(createArg.data.country_id).toBe(4);
  });

  it('regression: exact fingerprint hit IN the same country still merges (no create)', async () => {
    findFirst.mockResolvedValueOnce({ id: 55, name: 'Süt 1L', brand: 'Pınar', country_id: 1, muadil_grup_id: 'pinar-sut@1000ml' });

    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'Pınar Süt 1L', brand: 'Pınar', country_code: 'TR',
    });

    expect(isNew).toBe(false);
    expect(product.id).toBe(55);
    expect(create).not.toHaveBeenCalled();
    const fingerprintCall = findFirst.mock.calls.find(c => c[0]?.where?.muadil_grup_id);
    expect(fingerprintCall?.[0].where.country_id).toBe(1);
  });
});
