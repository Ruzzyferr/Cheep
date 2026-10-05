import { describe, it, expect, vi, beforeEach } from 'vitest';

const reportFindMany = vi.fn();
const spFindUnique = vi.fn();
const spCreate = vi.fn();
const spUpdate = vi.fn();
const reportUpsert = vi.fn();
const productFindUnique = vi.fn();
const storeFindUnique = vi.fn();

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    userPriceReport: {
      findMany: (...a: any[]) => reportFindMany(...a),
      upsert: (...a: any[]) => reportUpsert(...a),
    },
    storePrice: {
      findUnique: (...a: any[]) => spFindUnique(...a),
      create: (...a: any[]) => spCreate(...a),
      update: (...a: any[]) => spUpdate(...a),
    },
    product: { findUnique: (...a: any[]) => productFindUnique(...a) },
    store: { findUnique: (...a: any[]) => storeFindUnique(...a) },
  },
}));

const { uzlasiyiYenile, bildirimOlustur } = await import('../src/api/user-prices/user-prices.service.js');

const taze = (user_id: number, price: number) => ({
  user_id,
  price,
  observed_on: new Date(),
});

beforeEach(() => {
  [reportFindMany, spFindUnique, spCreate, spUpdate, reportUpsert,
   productFindUnique, storeFindUnique].forEach((f) => f.mockReset());
});

describe('uzlasiyiYenile — bosluk doldurma', () => {
  it('fiyat YOKSA kullanici kaynakli olarak OLUSTURUR', async () => {
    reportFindMany.mockResolvedValue([taze(1, 50), taze(2, 50)]);
    spFindUnique.mockResolvedValue(null);
    spCreate.mockResolvedValue({});

    const r = await uzlasiyiYenile(10, 20);

    expect(r?.price).toBe(50);
    expect(spCreate).toHaveBeenCalledTimes(1);
    const arg = spCreate.mock.calls[0]![0] as any;
    expect(arg.data.source).toBe('user');
    expect(arg.data.confidence_score).toBeLessThan(1.0);
  });

  it('uzlasi YOKSA hicbir sey yazmaz', async () => {
    reportFindMany.mockResolvedValue([taze(1, 50)]); // tek kullanici
    const r = await uzlasiyiYenile(10, 20);
    expect(r).toBeNull();
    expect(spCreate).not.toHaveBeenCalled();
    expect(spUpdate).not.toHaveBeenCalled();
  });
});

describe('uzlasiyiYenile — SCRAPE fiyatini EZMEZ', () => {
  it('kaynak scrape ise GUNCELLEMEZ', async () => {
    // En kritik kural: elimizde kaynaktan gelen bir fiyat varsa kullanici
    // uzlasisi onu bozmaz. Aksi halde birkac kisi anlasip dogru fiyati
    // yanlisla degistirebilirdi.
    reportFindMany.mockResolvedValue([taze(1, 10), taze(2, 10), taze(3, 10)]);
    spFindUnique.mockResolvedValue({ id: 5, source: 'scrape' });

    await uzlasiyiYenile(10, 20);

    expect(spUpdate).not.toHaveBeenCalled();
    expect(spCreate).not.toHaveBeenCalled();
  });

  it('kaynak user ise TAZELER', async () => {
    reportFindMany.mockResolvedValue([taze(1, 60), taze(2, 60)]);
    spFindUnique.mockResolvedValue({ id: 7, source: 'user' });
    spUpdate.mockResolvedValue({});

    await uzlasiyiYenile(10, 20);

    expect(spUpdate).toHaveBeenCalledTimes(1);
    const arg = spUpdate.mock.calls[0]![0] as any;
    expect(Number(arg.data.price)).toBe(60);
  });
});

describe('bildirimOlustur — dogrulama', () => {
  beforeEach(() => {
    productFindUnique.mockResolvedValue({ id: 1, country_id: 1 });
    storeFindUnique.mockResolvedValue({ id: 2, country_id: 1 });
    reportUpsert.mockResolvedValue({});
    reportFindMany.mockResolvedValue([]);
  });

  it('sifir/negatif fiyat reddedilir', async () => {
    await expect(bildirimOlustur({ user_id: 1, product_id: 1, store_id: 2, price: 0 }))
      .rejects.toThrow();
  });

  it('asiri fiyat reddedilir', async () => {
    await expect(bildirimOlustur({ user_id: 1, product_id: 1, store_id: 2, price: 999999 }))
      .rejects.toThrow();
  });

  it('FARKLI ULKE urun-market cifti reddedilir', async () => {
    storeFindUnique.mockResolvedValue({ id: 2, country_id: 9 });
    await expect(bildirimOlustur({ user_id: 1, product_id: 1, store_id: 2, price: 50 }))
      .rejects.toThrow();
  });

  it('gecerli bildirim GUN bazli upsert eder', async () => {
    await bildirimOlustur({ user_id: 1, product_id: 1, store_id: 2, price: 50 });
    expect(reportUpsert).toHaveBeenCalledTimes(1);
    const arg = reportUpsert.mock.calls[0]![0] as any;
    const gun: Date = arg.where.user_id_product_id_store_id_observed_on.observed_on;
    // Saat bileseni SIFIRLANMIS olmali, yoksa "gunde bir" kurali tutmaz.
    expect(gun.getUTCHours()).toBe(0);
    expect(gun.getUTCMinutes()).toBe(0);
  });
});
