import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: { user: { update: (...a: any[]) => update(...a) } },
}));
vi.mock('../src/utils/country.js', () => ({
  getCountryByCode: vi.fn(async (c: string) => ({ id: c === 'DE' ? 3 : 1, code: c, currency: 'EUR' })),
}));

import { updateUser, SUPPORTED_LANGUAGES } from '../src/api/users/users.service.js';

beforeEach(() => update.mockReset());

describe('updateUser preferences', () => {
  it('maps country_code to country_id', async () => {
    update.mockResolvedValueOnce({ id: 1, language: 'tr', country_id: 3 });
    await updateUser(1, { country_code: 'DE' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ country_id: 3 }),
    }));
  });

  it('rejects an unsupported language', async () => {
    await expect(updateUser(1, { language: 'zz' })).rejects.toThrow(/dil/i);
  });

  it('exposes the supported language set', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['tr', 'en', 'de', 'pl', 'sv']);
  });
});
