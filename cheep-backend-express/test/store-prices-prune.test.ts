import { describe, it, expect, vi, beforeEach } from 'vitest';

const storePriceDeleteMany = vi.fn();
const productDeleteMany = vi.fn();
const isStrictCountryMock = vi.fn();

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    storePrice: { deleteMany: (...a: any[]) => storePriceDeleteMany(...a) },
    product: { deleteMany: (...a: any[]) => productDeleteMany(...a) },
  },
}));

vi.mock('../src/api/products/product-matcher.service.js', () => ({
  productMatcher: {},
  isStrictCountry: (...a: any[]) => isStrictCountryMock(...a),
}));

import { pruneStalePrices } from '../src/api/store-prices/store-prices.service.js';

beforeEach(() => {
  storePriceDeleteMany.mockReset();
  productDeleteMany.mockReset();
  isStrictCountryMock.mockReset();
  storePriceDeleteMany.mockResolvedValue({ count: 0 });
  productDeleteMany.mockResolvedValue({ count: 0 });
  isStrictCountryMock.mockResolvedValue(false);
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

describe('pruneStalePrices orphan null-EAN product cleanup (strict countries)', () => {
  it('deletes null-EAN orphan products when countryId is a strict-match country', async () => {
    isStrictCountryMock.mockResolvedValue(true);

    const result = await pruneStalePrices(42, 21);

    expect(isStrictCountryMock).toHaveBeenCalledWith(42);
    expect(productDeleteMany).toHaveBeenCalledTimes(2);
    const mfCall = productDeleteMany.mock.calls[0][0];
    expect(mfCall.where).toEqual({ ean_barcode: { startsWith: 'mf-' }, store_prices: { none: {} }, country_id: 42 });
    const orphanCall = productDeleteMany.mock.calls[1][0];
    expect(orphanCall.where).toEqual({ country_id: 42, ean_barcode: null, store_prices: { none: {} } });
    expect(result.deleted_orphan_products).toBe(0);
  });

  it('does NOT delete null-EAN orphan products for a non-strict country', async () => {
    isStrictCountryMock.mockResolvedValue(false);

    const result = await pruneStalePrices(7, 21);

    expect(isStrictCountryMock).toHaveBeenCalledWith(7);
    expect(productDeleteMany).toHaveBeenCalledTimes(1);
    expect(result.deleted_orphan_products).toBe(0);
  });

  it('does NOT call isStrictCountry or delete null-EAN orphans when countryId is absent', async () => {
    await pruneStalePrices(undefined, 21);

    expect(isStrictCountryMock).not.toHaveBeenCalled();
    expect(productDeleteMany).toHaveBeenCalledTimes(1);
  });
});
