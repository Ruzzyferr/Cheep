import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  product: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  category: { findUnique: vi.fn() },
  matchProposal: { create: vi.fn() },
};
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/utils/country.js', () => ({ getCountryIdByCode: vi.fn(async () => 5) }));

const { productMatcher } = await import('../src/api/products/product-matcher.service.js');

describe('category_slug resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves slug to category_id on create', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.category.findUnique.mockResolvedValue({ id: 12, slug: 'dairy-eggs' });
    prismaMock.product.create.mockResolvedValue({ id: 1 });

    await productMatcher.findOrCreateProduct({
      name: 'Mleko 1L', country_id: 5, category_slug: 'dairy-eggs',
    });

    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category_id: 12 }) }),
    );
  });

  it('unknown slug → category_id stays null (no throw)', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.category.findUnique.mockResolvedValue(null);
    prismaMock.product.create.mockResolvedValue({ id: 2 });

    await expect(productMatcher.findOrCreateProduct({
      name: 'Chleb', country_id: 5, category_slug: 'no-such-slug',
    })).resolves.toBeTruthy();
  });
});
