/**
 * Adres → çapa. Üç kapı sessiz yanlış eşleşmeyi engeller:
 *   1) ülke kapısı  2) şube kapısı  3) geocoder yokluğu
 */
/* eslint-disable import/first -- vi.mock fabrikaları aşağıdaki sabitlere kapanır. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const geo = {
  available: true,
  results: [] as { latitude: number; longitude: number }[],
  reverse: [] as { isoCountryCode?: string; city?: string; district?: string }[],
};
vi.mock('expo-location', () => ({
  Accuracy: { Low: 1, Balanced: 3 },
  geocodeAsync: async () => {
    if (!geo.available) throw new Error('Geocoder unavailable');
    return geo.results;
  },
  reverseGeocodeAsync: async () => geo.reverse,
}));

// GERÇEKÇİ MOCK: /stores/nearby uç noktası bir şey BULANA KADAR sınır kutusunu
// genişletir (±1° → ±3° → ±8°). Yani TR/PL içindeki HER koordinat için dolu bir
// liste döner — ama satırlar ülkenin öbür ucundan olabilir. Bu yüzden mock
// "kaç satır" değil, GERÇEK distanceKm değerleri döndürür: kapının doğruluğu
// yalnızca bu alanla sınanabilir. (Eski mock çıplak {id} nesneleri döndürüyordu
// ve tam da bu yüzden hatayı göremiyordu.)
const branches = { rows: [] as unknown[] };
vi.mock('../store.service', () => ({
  storeService: {
    getNearbyStores: vi.fn(async () => branches.rows),
  },
}));

/** Uç noktanın döndürdüğü satırın gerçekçi şekli. */
const row = (distanceKm: unknown, id = 1) => ({
  store_id: id,
  distanceKm,
  branch: { id, name: `Şube ${id}`, lat: 0, lon: 0, address: null, city: null },
});

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  setItemAsync: async () => {},
  getItemAsync: async () => null,
  deleteItemAsync: async () => {},
}));

import { searchAddress, validateCandidate } from '../geocode.service';
import { storeService } from '../store.service';
import { MAX_RADIUS_KM } from '../../utils/anchor';

const WARSAW = { lat: 52.23, lon: 21.01 };

beforeEach(() => {
  geo.available = true;
  geo.results = [];
  geo.reverse = [];
  branches.rows = [];
  vi.mocked(storeService.getNearbyStores).mockClear();
});

describe('searchAddress', () => {
  it('geocoder yoksa available=false döner (sessizce boş liste DEĞİL)', async () => {
    geo.available = false;
    const r = await searchAddress('Marszałkowska 1');
    expect(r).toEqual({ available: false, candidates: [] });
  });

  it('sonuçları ülke kodu + etiketle birlikte döner', async () => {
    geo.results = [{ latitude: 52.23, longitude: 21.01 }];
    geo.reverse = [{ isoCountryCode: 'pl', city: 'Warszawa', district: 'Śródmieście' }];

    const r = await searchAddress('Marszałkowska 1');

    expect(r.available).toBe(true);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].coords).toEqual(WARSAW);
    expect(r.candidates[0].countryCode).toBe('PL');
    expect(r.candidates[0].label).toContain('Warszawa');
  });

  it('sonuç yoksa boş liste ama available=true', async () => {
    geo.results = [];
    const r = await searchAddress('zzzz');
    expect(r).toEqual({ available: true, candidates: [] });
  });
});

describe('validateCandidate — 1. kapı: ülke', () => {
  it('desteklenmeyen ülke reddedilir', async () => {
    const v = await validateCandidate({
      label: 'Berlin', coords: { lat: 52.52, lon: 13.4 }, countryCode: null,
    });
    expect(v).toEqual({ status: 'unsupported_country' });
  });

  it('mevcut ama desteklenmeyen ülke kodu kapı tarafından kendi başına reddedilir', async () => {
    const v = await validateCandidate({
      label: 'Berlin', coords: { lat: 52.52, lon: 13.4 }, countryCode: 'DE',
    });
    expect(v).toEqual({ status: 'unsupported_country' });
    expect(storeService.getNearbyStores).not.toHaveBeenCalled();
  });
});

describe('validateCandidate — 2. kapı: şube (MAX_RADIUS_KM içinde mi?)', () => {
  it('MAX_RADIUS_KM içinde şube varsa KOORDİNATLI pin döner', async () => {
    branches.rows = [row(MAX_RADIUS_KM - 0.2, 1), row(120, 2)];
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'ok',
      pin: { coords: WARSAW, countryCode: 'PL', label: 'Warszawa' },
    });
  });

  it('tam MAX_RADIUS_KM sınırındaki şube İSABET sayılır (kapsayıcı sınır)', async () => {
    branches.rows = [row(MAX_RADIUS_KM, 1)];
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v.status).toBe('ok');
  });

  it('şube listesi DOLU ama hepsi MAX_RADIUS_KM dışındaysa → no_branches, coords null', async () => {
    // Uç noktanın gerçek davranışı: sınır kutusunu ±8°'ye kadar genişletip ülkenin
    // öbür ucundaki şubeleri döndürür. Liste dolu diye koordinatı kabul edersek,
    // kullanıcı 3 km yarıçapla karşılaştırdığında BOŞ EKRAN görür.
    branches.rows = [row(87.4, 1), row(310.2, 2), row(MAX_RADIUS_KM + 0.1, 3)];
    const v = await validateCandidate({
      label: 'Ustrzyki Górne', coords: { lat: 49.09, lon: 22.68 }, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'no_branches',
      pin: { coords: null, countryCode: 'PL', label: 'Ustrzyki Górne' },
    });
    expect(v.status === 'no_branches' && v.pin.coords).toBeNull();
  });

  it('hiç şube dönmezse → no_branches, coords null', async () => {
    branches.rows = [];
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'no_branches',
      pin: { coords: null, countryCode: 'PL', label: 'Warszawa' },
    });
  });

  it('distanceKm eksik / NaN / sayı-değil olan satır İSABET SAYILMAZ', async () => {
    branches.rows = [
      { store_id: 1, branch: { id: 1, name: 'A', lat: 0, lon: 0, address: null, city: null } }, // alan yok
      row(Number.NaN, 2),
      row('0.4', 3), // string
      row(null, 4),
    ];
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'no_branches',
      pin: { coords: null, countryCode: 'PL', label: 'Warszawa' },
    });
  });

  it('ağ hatasında temkinli davranır — koordinat kullanılmaz', async () => {
    vi.mocked(storeService.getNearbyStores).mockRejectedValueOnce(new Error('network'));
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'no_branches',
      pin: { coords: null, countryCode: 'PL', label: 'Warszawa' },
    });
  });
});
