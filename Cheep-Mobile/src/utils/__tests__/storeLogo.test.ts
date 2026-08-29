import { describe, it, expect } from 'vitest';
import { getStoreTint, getStoreInitial, getStoreLogoAsset } from '../storeLogo';
import { colors } from '../../theme';

/**
 * Market rozeti rengi. Eskiden yalnızca 5 Türk zinciri tanımlıydı ve geri kalan
 * HER market aynı `primary.main` rengine düşüyordu — Polonya kullanıcısı
 * Biedronka, Lidl, Żabka ve Auchan'ı renkle ayırt edemiyordu.
 */
describe('getStoreTint', () => {
  const chips = colors.storeChips as Record<string, string>;

  it('dört ülkenin zincirlerini birbirinden ayırt eder', () => {
    const names = [
      'Migros', 'BİM', 'A101', 'ŞOK', 'CarrefourSA',        // TR
      'Biedronka', 'Żabka', 'Lidl', 'Auchan',                // PL
      'Konzum', 'Plodine', 'Tommy', 'Spar', 'Kaufland',      // HR
      'Tesco', 'Aldi', 'Penny',                              // HU
      'Mega Image', 'Profi',                                 // RO
    ];
    const tints = names.map(getStoreTint);
    // Hiçbiri jenerik yedeğe düşmemeli.
    expect(tints).not.toContain(colors.primary.main);
  });

  it("REGRESYON: 'BİM' Türkçe noktalı İ yüzünden jeneriğe düşmemeli", () => {
    // JS'te 'BİM'.toLowerCase() === 'bi̇m' (i + BİRLEŞEN NOKTA), yani
    // düz `includes('bim')` FALSE döner ve Türkiye'nin en büyük indirimcisi
    // renksiz kalırdı. foldName() NFD ile birleşen işaretleri atıyor.
    expect('BİM'.toLowerCase()).not.toBe('bim');   // hatanın kendisi
    expect(getStoreTint('BİM')).toBe(chips.bim);   // düzeltme
  });

  it('aksansız yazımı da tanır (Zabka / Sok)', () => {
    expect(getStoreTint('Zabka')).toBe(chips.zabka);
    expect(getStoreTint('Żabka')).toBe(chips.zabka);
    expect(getStoreTint('Sok Market')).toBe(chips.sok);
  });

  it('Interspar da Spar rengine düşer (aynı marka)', () => {
    expect(getStoreTint('Interspar Zagreb')).toBe(chips.spar);
  });

  it('CarrefourSA ve Carrefour aynı markadır, aynı renge gider', () => {
    expect(getStoreTint('CarrefourSA')).toBe(getStoreTint('Carrefour'));
  });

  it('bilinmeyen market jenerik renge düşer (çökmez)', () => {
    expect(getStoreTint('Bilinmeyen Market')).toBe(colors.primary.main);
    expect(getStoreTint(null)).toBe(colors.primary.main);
    expect(getStoreTint(undefined)).toBe(colors.primary.main);
    expect(getStoreTint('')).toBe(colors.primary.main);
  });
});

describe('getStoreInitial', () => {
  it('baş harfi büyük döner', () => {
    expect(getStoreInitial('konzum')).toBe('K');
    expect(getStoreInitial('  tesco')).toBe('T');
  });

  it('boş adda çökmez', () => {
    expect(getStoreInitial('')).toBe('?');
    expect(getStoreInitial(null)).toBe('?');
  });
});

describe('logo varlıkları', () => {
  it('telifli logo TAŞINMAZ — her zaman null', () => {
    // Bu kasıtlı bir hukuki karar (bkz. storeLogo.ts başlığı); biri buraya
    // logo eklemeye kalkarsa test bunu görünür kılsın.
    expect(getStoreLogoAsset('HR', 'Konzum')).toBeNull();
  });
});
