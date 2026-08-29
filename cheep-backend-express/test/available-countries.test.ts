import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const count = vi.fn();

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    country: { findMany: (...a: any[]) => findMany(...a) },
    product: { count: (...a: any[]) => count(...a) },
  },
}));

import {
  getAvailableCountries,
  __clearAvailableCountriesCache,
  MIN_PRODUCTS,
} from '../src/api/app/countries.service.js';

const COUNTRIES = [
  { id: 1, code: 'TR', name: 'Türkiye', currency: 'TRY' },
  { id: 5, code: 'PL', name: 'Polska', currency: 'PLN' },
  { id: 6, code: 'HR', name: 'Hrvatska', currency: 'EUR' },
];

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
  __clearAvailableCountriesCache();
  findMany.mockResolvedValue(COUNTRIES);
});

/**
 * Bu uç noktanın işi, "önce veri sonra sürüm" sırasının elle korunması
 * gerekliliğini ortadan kaldırmak: istemcinin sabit listesi ÜST SINIR,
 * burası KAPI. Sıra bozulursa ülke görünmez — kullanıcı boş katalog yerine
 * hiçbir şey görmez, ki doğru olan budur.
 */
describe('verisi olan ülkeler', () => {
  it('yalnızca anlamlı kataloğu olan ülkeleri döner', async () => {
    count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.country_id === 6 ? 0 : 20_000));
    const rows = await getAvailableCountries();
    expect(rows.map((r) => r.code)).toEqual(['TR', 'PL']);
  });

  it('eşiğin ALTINDAKİ ülke gösterilmez', async () => {
    // Birkaç yüz test ürünüyle ülke açmak da boş uygulama hissi verir.
    count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.country_id === 6 ? MIN_PRODUCTS - 1 : 20_000));
    const rows = await getAvailableCountries();
    expect(rows.map((r) => r.code)).not.toContain('HR');
  });

  it('eşiği geçen ülke KENDİLİĞİNDEN belirir (sürüm gerekmez)', async () => {
    count.mockResolvedValue(MIN_PRODUCTS);
    const rows = await getAvailableCountries();
    expect(rows.map((r) => r.code)).toEqual(['TR', 'PL', 'HR']);
  });

  it('yalnızca FİYATI olan ürünleri sayar', async () => {
    // Fiyatsız ürün satırı kullanıcıya hiçbir şey göstermez: katalog dolu
    // görünür, her ekran boş çıkar.
    count.mockResolvedValue(20_000);
    await getAvailableCountries();
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ store_prices: { some: {} } }),
      }),
    );
  });

  it('para birimi ve adı taşır (istemci biçimlendirme için kullanıyor)', async () => {
    count.mockResolvedValue(20_000);
    const rows = await getAvailableCountries();
    expect(rows[0]).toMatchObject({ code: 'TR', name: 'Türkiye', currency: 'TRY' });
  });

  it('sonucu önbelleğe alır (her açılışta çağrılıyor)', async () => {
    count.mockResolvedValue(20_000);
    await getAvailableCountries();
    await getAvailableCountries();
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
