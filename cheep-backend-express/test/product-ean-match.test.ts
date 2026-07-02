import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const create = vi.fn();
const upsert = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    product: {
      findFirst: (...a: any[]) => findFirst(...a),
      create: (...a: any[]) => create(...a),
      upsert: (...a: any[]) => upsert(...a),
      findMany: (...a: any[]) => findMany(...a),
      update: (...a: any[]) => update(...a),
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('../src/utils/country.js', () => ({
  getCountryIdByCode: vi.fn(async (code?: string) =>
    ({ DE: 4, CH: 2, SE: 3, PL: 5 } as Record<string, number>)[code ?? ''] ?? undefined),
}));

import { productMatcher } from '../src/api/products/product-matcher.service.js';

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
  upsert.mockReset();
  findMany.mockReset();
  update.mockReset();
});

describe('findOrCreateProduct EAN-first (country-scoped)', () => {
  it('same EAN + same country → returns the existing product (no create)', async () => {
    // First findFirst = EAN lookup → hit.
    findFirst.mockResolvedValueOnce({ id: 99, name: 'REWE Milch', country_id: 4, ean_barcode: '4008400404127', muadil_grup_id: null });
    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'REWE Bio Milch 1L', ean_barcode: '4008400404127', country_code: 'DE',
    });
    expect(isNew).toBe(false);
    expect(product.id).toBe(99);
    expect(create).not.toHaveBeenCalled();
  });

  it('same EAN + different country → does NOT match, creates a new product (country-scoped)', async () => {
    // EAN lookup is country-scoped → miss for CH even though DE has it.
    findFirst.mockResolvedValue(null); // EAN miss
    create.mockResolvedValueOnce({ id: 101, name: 'Migros Milch 1L', country_id: 2, ean_barcode: '4008400404127' });
    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'Migros Milch 1L', ean_barcode: '4008400404127', country_code: 'CH',
    });
    expect(isNew).toBe(true);
    expect(product.country_id).toBe(2);
    // EAN lookup must be scoped by country_id.
    const eanCall = findFirst.mock.calls.find(c => c[0]?.where?.ean_barcode);
    expect(eanCall?.[0].where.country_id).toBe(2);
    // create persists ean + country.
    expect(create.mock.calls[0][0].data.ean_barcode).toBe('4008400404127');
    expect(create.mock.calls[0][0].data.country_id).toBe(2);
  });

  it('race-safe: on unique-violation (P2002) it returns the concurrently-created product', async () => {
    // EAN miss on first lookup, but a parallel request creates it before our create.
    findFirst
      .mockResolvedValueOnce(null) // initial EAN lookup → miss
      .mockResolvedValueOnce({ id: 55, name: 'Sütaş Kaşar', country_id: 1, ean_barcode: 'mf-389' }); // re-fetch after P2002
    create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'Sütaş Kaşar', ean_barcode: 'mf-389', country_id: 1,
    });
    expect(isNew).toBe(false);
    expect(product.id).toBe(55);
  });

  it('persists ean_barcode on create', async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValueOnce({ id: 7, name: 'ICA Mjölk', country_id: 3, ean_barcode: '7300000000001' });
    await productMatcher.findOrCreateProduct({
      name: 'ICA Mjölk 1L', ean_barcode: '7300000000001', country_code: 'SE',
    });
    expect(create.mock.calls[0][0].data.ean_barcode).toBe('7300000000001');
  });

  it('no EAN → falls back to fingerprint path (EAN lookup not attempted)', async () => {
    findFirst.mockResolvedValue(null); // fingerprint exact-match miss
    findMany.mockResolvedValueOnce([]);
    create.mockResolvedValueOnce({ id: 12, name: 'Süt', country_id: 4 });
    await productMatcher.findOrCreateProduct({ name: 'Süt 1L', brand: 'Pınar', country_code: 'DE' });
    // No findFirst call should carry an ean_barcode where-clause.
    const eanCall = findFirst.mock.calls.find(c => c[0]?.where?.ean_barcode);
    expect(eanCall).toBeUndefined();
  });
});
