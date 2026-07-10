import { describe, it, expect, vi, beforeEach } from 'vitest';

const storePriceDeleteMany = vi.fn();
const productDeleteMany = vi.fn();

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    storePrice: { deleteMany: (...a: any[]) => storePriceDeleteMany(...a) },
    product: { deleteMany: (...a: any[]) => productDeleteMany(...a) },
  },
}));

import { pruneStalePrices } from '../src/api/store-prices/store-prices.service.js';

beforeEach(() => {
  storePriceDeleteMany.mockReset();
  productDeleteMany.mockReset();
  storePriceDeleteMany.mockResolvedValue({ count: 0 });
  productDeleteMany.mockResolvedValue({ count: 0 });
});

describe('pruneStalePrices where-clause (scrape source pruning)', () => {
  it('prunes both api AND scrape sourced prices older than the TTL', async () => {
    await pruneStalePrices(undefined, 21);

    expect(storePriceDeleteMany).toHaveBeenCalledTimes(1);
    const { where } = storePriceDeleteMany.mock.calls[0][0];
    expect(where.source).toEqual({ in: ['api', 'scrape'] });
    expect(where.last_updated_at.lt).toBeInstanceOf(Date);
  });

  it('scopes to a country when countryId is passed', async () => {
    await pruneStalePrices(42, 21);

    const { where } = storePriceDeleteMany.mock.calls[0][0];
    expect(where.source).toEqual({ in: ['api', 'scrape'] });
    expect(where.product).toEqual({ country_id: 42 });
  });
});
