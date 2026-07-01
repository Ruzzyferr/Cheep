import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: { country: { findUnique: (...a: any[]) => findUnique(...a) } },
}));

import { getCountryByCode, __clearCountryCache } from '../src/utils/country.js';

beforeEach(() => { findUnique.mockReset(); __clearCountryCache(); });

describe('getCountryByCode', () => {
  it('returns id+code+currency for a known code', async () => {
    findUnique.mockResolvedValueOnce({ id: 3, code: 'DE', currency: 'EUR' });
    const c = await getCountryByCode('de');
    expect(c).toEqual({ id: 3, code: 'DE', currency: 'EUR' });
  });

  it('throws on unknown code', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(getCountryByCode('ZZ')).rejects.toThrow(/Bilinmeyen ülke/);
  });
});
