/**
 * Çapa çözümlemesi — saf kurallar. Tüm konum/ülke davranışı buradan türer.
 */
import { describe, it, expect, vi } from 'vitest';

const mem = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  setItemAsync: async (k: string, v: string) => void mem.set(k, v),
  getItemAsync: async (k: string) => mem.get(k) ?? null,
  deleteItemAsync: async (k: string) => void mem.delete(k),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

/* eslint-disable import/first */
import { resolveAnchor, shouldFilterByDistance, anchorStorage } from '../anchor';
import type { ShoppingAnchor } from '../anchor';
/* eslint-enable import/first */

const IZMIR = { lat: 38.42, lon: 27.14 };
const WARSAW = { lat: 52.23, lon: 21.01 };
const NOW = 1_700_000_000_000;

describe('resolveAnchor — otomatik mod', () => {
  it('GPS + desteklenen ülke → koordinatlı çapa, ülke güncellenir', () => {
    const a = resolveAnchor({
      mode: 'auto', pinned: null, gps: WARSAW,
      detectedCountry: 'PL', lastCountry: 'TR', now: NOW,
    });
    expect(a).toEqual({
      mode: 'auto', coords: WARSAW, countryCode: 'PL', label: null, resolvedAt: NOW,
    });
  });

  it('desteklenmeyen ülke (detectedCountry=null) → son ülke korunur, KOORDİNAT KULLANILMAZ', () => {
    // Kullanıcı Almanya\'da. GPS var ama ülke desteklenmiyor. Alman koordinatıyla
    // Türk kataloğunu filtrelersek 0 sonuç çıkar — tam da düzelttiğimiz hata.
    const a = resolveAnchor({
      mode: 'auto', pinned: null, gps: { lat: 52.52, lon: 13.4 },
      detectedCountry: null, lastCountry: 'TR', now: NOW,
    });
    expect(a.countryCode).toBe('TR');
    expect(a.coords).toBeNull();
  });

  it('GPS yok (izin/rıza yok) → koordinatsız, son ülke korunur', () => {
    const a = resolveAnchor({
      mode: 'auto', pinned: null, gps: null,
      detectedCountry: null, lastCountry: 'PL', now: NOW,
    });
    expect(a.coords).toBeNull();
    expect(a.countryCode).toBe('PL');
  });
});

describe('resolveAnchor — sabitlenmiş mod', () => {
  it('pin GPS\'i EZER: kullanıcı İzmir\'de ama Varşova\'ya sabitlemiş', () => {
    const a = resolveAnchor({
      mode: 'pinned',
      pinned: { coords: WARSAW, countryCode: 'PL', label: 'Warszawa' },
      gps: IZMIR, detectedCountry: 'TR', lastCountry: 'TR', now: NOW,
    });
    expect(a).toEqual({
      mode: 'pinned', coords: WARSAW, countryCode: 'PL', label: 'Warszawa', resolvedAt: NOW,
    });
  });

  it('koordinatsız pin (şube bulunamamıştı) → yalnızca ülke sabitlenir', () => {
    const a = resolveAnchor({
      mode: 'pinned',
      pinned: { coords: null, countryCode: 'PL', label: 'Polonya' },
      gps: IZMIR, detectedCountry: 'TR', lastCountry: 'TR', now: NOW,
    });
    expect(a.coords).toBeNull();
    expect(a.countryCode).toBe('PL');
  });

  it('mod pinned ama pin yoksa otomatiğe düşer (bozuk durum kurtarma)', () => {
    const a = resolveAnchor({
      mode: 'pinned', pinned: null, gps: IZMIR,
      detectedCountry: 'TR', lastCountry: 'TR', now: NOW,
    });
    expect(a.mode).toBe('auto');
    expect(a.coords).toEqual(IZMIR);
  });
});

describe('shouldFilterByDistance — MERKEZÎ İNVARYANT', () => {
  const base: ShoppingAnchor = {
    mode: 'auto', coords: IZMIR, countryCode: 'TR', label: null, resolvedAt: NOW,
  };

  it('koordinat var + ülke eşleşiyor → filtre AÇIK', () => {
    expect(shouldFilterByDistance(base, 'TR')).toBe(true);
  });

  it('koordinat var ama ülke eşleşmiyor → filtre KAPALI', () => {
    expect(shouldFilterByDistance(base, 'PL')).toBe(false);
  });

  it('koordinat yok → filtre KAPALI', () => {
    expect(shouldFilterByDistance({ ...base, coords: null }, 'TR')).toBe(false);
  });
});

describe('anchorStorage', () => {
  it('varsayılan mod auto', async () => {
    mem.clear();
    expect(await anchorStorage.getMode()).toBe('auto');
  });

  it('setPinned modu pinned yapar; clearPin auto\'ya döndürür ve pini siler', async () => {
    mem.clear();
    await anchorStorage.setPinned({ coords: WARSAW, countryCode: 'PL', label: 'Warszawa' });
    expect(await anchorStorage.getMode()).toBe('pinned');
    expect(await anchorStorage.getPinned()).toEqual({
      coords: WARSAW, countryCode: 'PL', label: 'Warszawa',
    });

    await anchorStorage.clearPin();
    expect(await anchorStorage.getMode()).toBe('auto');
    expect(await anchorStorage.getPinned()).toBeNull();
  });

  it('bozuk JSON → null (çökme yok)', async () => {
    mem.clear();
    mem.set('pinned_anchor', '{bozuk');
    expect(await anchorStorage.getPinned()).toBeNull();
  });
});
