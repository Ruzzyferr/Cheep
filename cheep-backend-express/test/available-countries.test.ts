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

  it('KATALOGU sayar — fiyat sartı ARANMAZ', async () => {
    // KURAL DEĞİŞTİ (5 Eki 2026). Eskiden yalnızca fiyatı olan ürünler
    // sayılıyordu; o kural fiyatın tek kaynağının resmi akış olduğu dönemde
    // doğruydu.
    //
    // Artık kullanıcı fiyat bildirebiliyor. Eski kural KISIR DÖNGÜ üretiyor:
    // fiyat yok → ülke seçilemez → kullanıcı bildiremez → hiç fiyat oluşmaz.
    // TR/PL/HU/RO verisi kaldırıldıktan sonra tam bu tuzağa düştü.
    count.mockResolvedValue(20_000);
    await getAvailableCountries();
    const cagri = count.mock.calls[0]![0] as any;
    expect(cagri.where).not.toHaveProperty('store_prices');
    expect(cagri.where).toHaveProperty('country_id');
  });

  it('fiyatsiz ama katalogu olan ulke LISTELENIR', async () => {
    // Kullanici oraya fiyat bildirebilsin diye. Ekranlar "ilk fiyati sen
    // ekle" diyor ve dogrudan bildirim dugmesi sunuyor.
    count.mockResolvedValue(MIN_PRODUCTS);
    const rows = await getAvailableCountries();
    expect(rows.length).toBeGreaterThan(0);
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
