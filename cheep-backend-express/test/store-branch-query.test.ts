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

// ─────────────────────────────────────────────────────────────────────────────
// radius (2026-08-26)
//
// `/stores/nearby` `radius` sorgu parametresini SESSIZCE YOK SAYIYORDU:
// `radius=1` diyen bir çağıran 4,6 km'deki şubeyi "yakın" sanıyordu (canlıda
// doğrulandı: radius=1 ve radius=3 aynı 6 şubeyi döndürüyordu). Servis artık
// `radiusKm` alıyor; parametre YOKKEN davranış birebir eskisi gibi kalmalı.
// ─────────────────────────────────────────────────────────────────────────────

const ISTANBUL = { lat: 41.0082, lon: 28.9784 };
const sube = (id: number, name: string, lat: number, lon: number) =>
  ({ id, store_id: id, name, lat, lon, address: null, city: 'İstanbul' });

describe('getNearbyStores radius süzmesi', () => {
  it('radius verilmezse HİÇBİR mesafe kesmesi uygulamaz (eski davranış korunur)', async () => {
    findMany.mockResolvedValueOnce([
      sube(1, 'Şok', 41.0100, 28.9800),
      sube(2, 'Uzak Market', 41.0500, 29.0400),
    ]);
    const res = await getNearbyStores(1, ISTANBUL);
    expect(res).toHaveLength(2);
  });

  it('radius verilirse yarıçap dışındaki şubeyi ELER', async () => {
    findMany.mockResolvedValueOnce([
      sube(1, 'Şok', 41.0100, 28.9800),
      sube(2, 'Uzak Market', 41.0500, 29.0400),
    ]);
    const res = await getNearbyStores(1, ISTANBUL, undefined, 1);
    expect(res.map((r) => r.branch.name)).toEqual(['Şok']);
  });

  it('yarıçapta hiç şube yoksa BOŞ döner — kutuyu genişletmez', async () => {
    // Kutu büyüdükçe mesafeler yalnızca ARTAR; genişletmek yarıçapa asla
    // yeni bir aday getiremez. İkinci sorgu HİÇ atılmamalı.
    findMany.mockResolvedValueOnce([sube(2, 'Uzak Market', 41.0500, 29.0400)]);
    const res = await getNearbyStores(1, ISTANBUL, undefined, 1);
    expect(res).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('sınırdaki şube DAHİL edilir (<= karşılaştırması)', async () => {
    // İKİ çağrı yapılıyor (önce mesafeyi öğren, sonra tam o mesafeyi sınır ver)
    // → mock'un İKİSİNE de yanıt vermesi gerekir.
    findMany.mockResolvedValue([sube(1, 'Şok', 41.0100, 28.9800)]);
    const uzaklik = (await getNearbyStores(1, ISTANBUL, undefined, 999))[0].distanceKm;
    const res = await getNearbyStores(1, ISTANBUL, undefined, uzaklik);
    expect(res).toHaveLength(1);
  });
});
