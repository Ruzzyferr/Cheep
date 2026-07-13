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

const branches = { count: 0 };
vi.mock('../store.service', () => ({
  storeService: {
    getNearbyStores: async () =>
      Array.from({ length: branches.count }, (_, i) => ({ id: i })),
  },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  setItemAsync: async () => {},
  getItemAsync: async () => null,
  deleteItemAsync: async () => {},
}));

import { searchAddress, validateCandidate } from '../geocode.service';

const WARSAW = { lat: 52.23, lon: 21.01 };

beforeEach(() => {
  geo.available = true;
  geo.results = [];
  geo.reverse = [];
  branches.count = 0;
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
});

describe('validateCandidate — 2. kapı: şube', () => {
  it('çevrede şube varsa KOORDİNATLI pin döner', async () => {
    branches.count = 5;
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'ok',
      pin: { coords: WARSAW, countryCode: 'PL', label: 'Warszawa' },
    });
  });

  it('çevrede şube YOKSA pin KOORDİNATSIZ döner — yoksa boş ekran üretirdi', async () => {
    branches.count = 0;
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'no_branches',
      pin: { coords: null, countryCode: 'PL', label: 'Warszawa' },
    });
  });
});
