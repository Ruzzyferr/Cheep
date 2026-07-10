import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  matchProposal: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  country: { findFirst: vi.fn() },
};
const mergeMock = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/api/products/product-matcher.service.js', () => ({
  productMatcher: { mergeProducts: mergeMock },
}));

const { approveProposal, rejectProposal } = await import('../src/services/match-review.service.js');

describe('match review', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approve merges product into candidate and closes siblings', async () => {
    prismaMock.matchProposal.findUnique.mockResolvedValue({
      id: 1, product_id: 901, candidate_product_id: 900, status: 'pending',
    });
    await approveProposal(1);
    expect(mergeMock).toHaveBeenCalledWith(901, 900);
    expect(prismaMock.matchProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { status: 'approved' } }),
    );
    expect(prismaMock.matchProposal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product_id: 901, status: 'pending', id: { not: 1 } },
        data: { status: 'rejected' },
      }),
    );
  });

  it('approve on non-pending proposal throws', async () => {
    prismaMock.matchProposal.findUnique.mockResolvedValue({ id: 2, status: 'approved' });
    await expect(approveProposal(2)).rejects.toThrow();
    expect(mergeMock).not.toHaveBeenCalled();
  });

  it('reject only flips status', async () => {
    prismaMock.matchProposal.findUnique.mockResolvedValue({ id: 3, status: 'pending' });
    await rejectProposal(3);
    expect(mergeMock).not.toHaveBeenCalled();
  });
});
