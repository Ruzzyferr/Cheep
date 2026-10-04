import { describe, it, expect } from 'vitest';
import { jenerikParmakIzi, jenerikMiktar } from '../src/services/generic-grouping.js';

/**
 * Kullanıcı geri bildirimi (4 Ekim 2026): "süt yumurta yoğurt alacağım, marka
 * önemsemiyorum". Kural: aynı tür + aynı miktar ikame olur, NİTELİKLER AYRI.
 *
 * Buradaki testlerin çoğu, gerçek katalog üzerinde doğrulama yaparken
 * YAKALANAN hataları sabitliyor. Hepsi bir kez gerçekten yanlıştı.
 */
const fp = (name: string, brand?: string) => jenerikParmakIzi({ name, brand });

describe('jenerikMiktar', () => {
  it('ADET agirliga tercih edilir', () => {
    // "53-62 Gr 30 Adet" -> extractGramaj 62g veriyordu; yumurtalar bu yuzden
    // hic gruplanamiyordu.
    expect(jenerikMiktar('Anadolu Çiftliği Yumurta 53-62 Gr 30 Adet')).toBe('30adet');
  });
  it("'li eki adet sayilir", () => {
    expect(jenerikMiktar("Yumurta 10'lu")).toBe('10adet');
  });
  it('hacim ml ye normallesir', () => {
    expect(jenerikMiktar('Süt 1 Lt')).toBe('1000ml');
    expect(jenerikMiktar('Ayran 200 Ml')).toBe('200ml');
  });
  it('coklu paket carpilir', () => {
    expect(jenerikMiktar('Su 2 x 500 Ml')).toBe('1000ml');
  });
  it('miktarsiz isim null', () => {
    expect(jenerikMiktar('Taze Maydanoz')).toBeNull();
  });
});

describe('jenerikParmakIzi — ikame OLUSUR', () => {
  it('ayni urun farkli markalar ayni gruba duser', () => {
    const a = fp('Carrefour Tereyağı 1 Kg', 'Carrefour');
    const b = fp('Mis Tereyağı 1 Kg', 'Mis');
    expect(a).toBe(b);
    expect(a).toContain('@1000g');
  });
  it('yumurta markadan bagimsiz gruplanir', () => {
    expect(fp('Bili Bili Yumurta 15 Adet', 'Bili Bili'))
      .toBe(fp('Yumurtacım Yumurta 15 Adet', 'Yumurtacım'));
  });
});

describe('jenerikParmakIzi — ikame OLUSMAZ (korunan ayrimlar)', () => {
  it('nitelik ayrimi korunur: organik != normal', () => {
    expect(fp('A Organik Yumurta 10 Adet', 'A')).not.toBe(fp('B Yumurta 10 Adet', 'B'));
  });
  it('laktozsuz sut normal sutle karismaz', () => {
    expect(fp('Pınar Laktozsuz Süt 1 Lt', 'Pınar')).not.toBe(fp('Pınar Süt 1 Lt', 'Pınar'));
  });
  it('farkli miktar ayri grup', () => {
    expect(fp('X Süt 1 Lt', 'X')).not.toBe(fp('X Süt 500 Ml', 'X'));
  });
  it('yag orani ayri grup', () => {
    expect(fp('X Süt %3 1 Lt', 'X')).not.toBe(fp('X Süt %1 1 Lt', 'X'));
  });

  it('SU ile KOLA ayni gruba DUSMEZ', () => {
    // Gercek hata: baseNormalize ondaligi bozunca "1.5 Lt" -> "1 5 lt" oluyor,
    // birim temizligi "5 lt"yi aliyor ve cekirdek "1" kaliyordu; iki urun de
    // "1@1500ml" uretiyordu.
    const su = fp('Abant Su 1.5 Lt', 'Abant');
    const kola = fp('Coca-Cola 1.5 Lt', 'Coca-Cola');
    expect(su).toBe('su@1500ml');
    expect(su).not.toBe(kola);
  });

  it('BEBEK MAMASI hic gruplanmaz', () => {
    // Gercek hata: kademe numarasi rakam diye silinince Pronutra 1/2/4/5 tek
    // gruba cokmustu. 1. kademe bebege 5. kademe onermek zarar verir.
    expect(fp('Aptamil Pronutra 1 Devam Sütü 800 Gr', 'Aptamil')).toBeNull();
    expect(fp('Aptamil Pronutra 5 Devam Sütü 800 Gr', 'Aptamil')).toBeNull();
  });

  it('kademe/varyant numarasi ayirt edicidir', () => {
    expect(fp('Marka Kahve 2 Numara 100 Gr', 'Marka'))
      .not.toBe(fp('Marka Kahve 5 Numara 100 Gr', 'Marka'));
  });

  it('cekirdegi sadece rakam olan urun gruplanmaz', () => {
    expect(fp('123 500 Gr', '')).toBeNull();
  });
});

describe('Turkce normallestirme', () => {
  it("buyuk I bastaki harfi dusurmez", () => {
    expect(fp('Arbella İrmik 500 Gr', 'Arbella')).toBe('irmik@500g');
  });
  it("I'li ve I'siz yazim ayni gruba duser", () => {
    expect(fp('Arbella İrmik 500 Gr', 'Arbella')).toBe(fp('Migros Irmik 500 Gr', 'Migros'));
  });
  it('iyelik eki koke iner: yumurtasi = yumurta', () => {
    expect(fp('A Tavuk Yumurtası 10 Adet', 'A')).toBe(fp('B Tavuk Yumurta 10 Adet', 'B'));
  });
});

describe('gramaj araligi', () => {
  it('"53-62 Gr" olcudur, varyant numarasi degil', () => {
    const a = jenerikParmakIzi({ name: 'Bili Bili Yumurta 53-62 Gr 30 Adet', brand: 'Bili Bili' });
    const b = jenerikParmakIzi({ name: 'Keskinoğlu Yumurta 30 Adet', brand: 'Keskinoğlu' });
    expect(a).toBe('yumurta@30adet');
    expect(a).toBe(b);
  });
  it('kademe numarasi HALA ayirt edici', () => {
    const a = jenerikParmakIzi({ name: 'Marka Kahve 2 Numara 100 Gr', brand: 'Marka' });
    const b = jenerikParmakIzi({ name: 'Marka Kahve 5 Numara 100 Gr', brand: 'Marka' });
    expect(a).not.toBe(b);
  });
});

describe('boy/ambalaj gurultusu', () => {
  it('"M Boy" ikameyi engellemez', () => {
    const a = jenerikParmakIzi({ name: 'Akyaka Yumurta M Boy 15 Adet', brand: 'Akyaka' });
    const b = jenerikParmakIzi({ name: 'Carrefour Yumurta 15 Adet', brand: 'Carrefour' });
    expect(a).toBe('yumurta@15adet');
    expect(a).toBe(b);
  });
  it('nitelik HALA ayirir (boy temizlense de)', () => {
    const a = jenerikParmakIzi({ name: 'X Gezen Yumurta M Boy 10 Adet', brand: 'X' });
    const b = jenerikParmakIzi({ name: 'Y Yumurta 10 Adet', brand: 'Y' });
    expect(a).not.toBe(b);
  });
});
