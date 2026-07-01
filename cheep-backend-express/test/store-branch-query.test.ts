import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: { storeBranch: { findMany: (...a: any[]) => findMany(...a) } } }));

import { getNearbyStores } from '../src/services/store-branch.service.js';

beforeEach(() => findMany.mockReset());

describe('getNearbyStores bbox widening + country scoping', () => {
  it('widens the bbox when the first query is empty', async () => {
    findMany
      .mockResolvedValueOnce([]) // delta 1.0 → empty
      .mockResolvedValueOnce([{ id: 1, store_id: 1, name: 'Migros Mardin', lat: 37.32, lon: 40.72, address: null, city: 'Mardin' }]);
    const res = await getNearbyStores(1, { lat: 37.32, lon: 40.74 });
    expect(res).toHaveLength(1);
    expect(res[0].branch.city).toBe('Mardin');
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('always scopes every query by country_id', async () => {
    findMany.mockResolvedValue([]);
    await getNearbyStores(7, { lat: 0, lon: 0 });
    for (const call of findMany.mock.calls) {
      expect(call[0].where.country_id).toBe(7);
    }
  });
});
