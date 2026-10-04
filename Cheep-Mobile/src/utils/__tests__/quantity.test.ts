import { describe, it, expect } from 'vitest';
import { formatQuantity, adetHaritasiKur } from '../quantity';

/**
 * Kullanıcı geri bildirimi (4 Ekim 2026): "sütten 3 tane alacağım adeti
 * artıramadım". `quantity` veri modelinde en baştan vardı; eksik olan arayüzdü.
 * Bu testler o arayüzün dayandığı iki saf parçayı yerinde tutuyor.
 */
describe('formatQuantity', () => {
  it('tam sayida ondalik basmaz', () => {
    expect(formatQuantity(3)).toBe('3');
    expect(formatQuantity(1)).toBe('1');
  });

  it('kesirli degeri korur (1.5 kg gibi)', () => {
    expect(formatQuantity(1.5)).toBe('1.5');
    expect(formatQuantity(0.25)).toBe('0.25');
  });

  it('kayan nokta artigini temizler', () => {
    // 0.1 + 0.2 = 0.30000000000000004 — ekranda boyle gorunmemeli.
    expect(formatQuantity(0.1 + 0.2)).toBe('0.3');
  });
});

describe('adetHaritasiKur', () => {
  const liste = {
    id: 7,
    list_items: [
      { id: 101, product_id: 11, quantity: 3 },
      { id: 102, product_id: 22, quantity: 1.5 },
    ],
  } as any;

  it('product_id uzerinden adet ve itemId dondurur', () => {
    const m = adetHaritasiKur(liste);
    expect(m.get(11)).toEqual({ itemId: 101, quantity: 3 });
    expect(m.get(22)).toEqual({ itemId: 102, quantity: 1.5 });
  });

  it('listede olmayan urun icin undefined', () => {
    expect(adetHaritasiKur(liste).get(999)).toBeUndefined();
  });

  it('bos/null listede patlamaz', () => {
    expect(adetHaritasiKur(null).size).toBe(0);
    expect(adetHaritasiKur(undefined).size).toBe(0);
    expect(adetHaritasiKur({ id: 1 } as any).size).toBe(0);
  });

  it('ALAN ADI `items` DEGIL `list_items` — yanlis adda harita bos kalir', () => {
    // Ilk yazimdaki sessiz hata. Alan adi degisirse bu test duser.
    const yanlis = { id: 7, items: [{ id: 1, product_id: 11, quantity: 3 }] } as any;
    expect(adetHaritasiKur(yanlis).size).toBe(0);
    expect(adetHaritasiKur(liste).size).toBe(2);
  });
});
