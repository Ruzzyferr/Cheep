import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  product: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  matchProposal: { create: vi.fn() },
  country: { findUnique: vi.fn() },
};
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/utils/country.js', () => ({
  getCountryIdByCode: vi.fn(async (code?: string) => (code === 'PL' ? 5 : 1)),
}));

process.env.STRICT_MATCH_COUNTRY_CODES = 'PL';
const { productMatcher, __setStrictCountryIdsForTest } = await import('../src/api/products/product-matcher.service.js');

describe('strict-country matching (PL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setStrictCountryIdsForTest(new Set([5]));
  });

  it('fuzzy candidate does NOT merge; creates product + pending proposal', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null); // no fingerprint match
    // one very similar existing candidate (same gramaj, sim >= 0.85)
    prismaMock.product.findMany.mockResolvedValue([
      { id: 900, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', muadil_grup_id: 'x' },
    ]);
    prismaMock.product.create.mockResolvedValue({ id: 901, name: 'Mleko Łaciate UHT 3,2% 1L' });

    const { product, isNew } = await productMatcher.findOrCreateProduct({
      name: 'Mleko Łaciate UHT 3,2% 1L', brand: 'Łaciate', country_id: 5,
    });

    expect(isNew).toBe(true);
    expect(product.id).toBe(901);
    expect(prismaMock.matchProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          country_id: 5, product_id: 901, candidate_product_id: 900,
          evidence: 'fuzzy', status: 'pending',
        }),
      }),
    );
  });

  it('non-strict country (TR) keeps legacy fuzzy auto-merge', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([
      { id: 700, name: 'Pınar Süt 1L', brand: 'Pınar', muadil_grup_id: 'y' },
    ]);
    prismaMock.product.findUnique.mockResolvedValue({ id: 700, name: 'Pınar Süt 1L', muadil_grup_id: 'y' });
    prismaMock.product.update.mockResolvedValue({ id: 700 });

    const { isNew } = await productMatcher.findOrCreateProduct({
      name: 'Pinar Süt 1L', brand: 'Pınar', country_id: 1,
    });
    expect(isNew).toBe(false);
    expect(prismaMock.matchProposal.create).not.toHaveBeenCalled();
  });
});
