import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: { product: { findUnique: (...a: any[]) => findUnique(...a) } },
}));
vi.mock('../src/utils/country.js', () => ({ getCountryIdByCode: vi.fn() }));

import { getProductById } from '../src/api/products/products.service.js';

beforeEach(() => findUnique.mockReset());

describe('getProductById country scoping', () => {
  it('returns the product when country matches', async () => {
    findUnique.mockResolvedValueOnce({ id: 5, country_id: 3, store_prices: [], category: null });
    const p = await getProductById(5, 3);
    expect(p.id).toBe(5);
  });

  it('throws notFound when country differs', async () => {
    findUnique.mockResolvedValueOnce({ id: 5, country_id: 1, store_prices: [], category: null });
    await expect(getProductById(5, 3)).rejects.toThrow(/bulunamadı/i);
  });

  it('returns the product when countryId is undefined', async () => {
    findUnique.mockResolvedValueOnce({ id: 5, country_id: 1, store_prices: [], category: null });
    const p = await getProductById(5, undefined);
    expect(p.id).toBe(5);
  });
});
