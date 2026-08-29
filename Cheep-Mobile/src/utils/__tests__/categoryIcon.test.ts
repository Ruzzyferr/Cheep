import { describe, it, expect } from 'vitest';
import { getCategoryIcon } from '../categoryIcon';

/**
 * GERİLEME KORUMASI.
 *
 * Simge eşlemesi kategorinin GÖRÜNEN ADINA bakıyordu, oysa o ad istemcinin
 * diline çevriliyor. Sonuç: Türkçe dışındaki YEDİ dilin hepsinde bütün
 * kategoriler tek bir genel etikete düşüyordu — ana sayfada üst üste aynı
 * simgeden bir duvar. Hiçbir hata üretmiyordu; yalnızca Hırvatça ekran
 * görüntüsüyle fark edildi.
 *
 * Kritik nokta: simge, adın değil `icon_key`in (çeviriden önceki kanonik
 * slug) fonksiyonu olmalı.
 */
const DEFAULT_ICON = 'tag-outline';

// Aynı kategorinin beş dildeki görünen adı. Hepsi AYNI simgeyi vermeli.
const SUT_URUNLERI = [
  'Süt Ürünleri ve Kahvaltılık',
  'Mliječni proizvodi i doručak',
  'Tejtermék és reggeli',
  'Lactate și mic dejun',
  'Nabiał i śniadanie',
];

describe('getCategoryIcon', () => {
  it('aynı kategori, çevrilmiş adı ne olursa olsun AYNI simgeyi verir', () => {
    const icons = SUT_URUNLERI.map((name) =>
      getCategoryIcon(name, 'sut-urunleri-ve-kahvaltilik'),
    );
    expect(new Set(icons).size).toBe(1);
    expect(icons[0]).toBe('cheese');
    expect(icons[0]).not.toBe(DEFAULT_ICON);
  });

  it('icon_key adı EZER — ad yanıltıcı olsa bile', () => {
    // Ad tabanlı yol "meyve"yi görüp karpuz simgesi verirdi; kanonik anahtar
    // kazanmalı, yoksa iki yol çelişince hangisinin kazandığı belirsiz olur.
    expect(getCategoryIcon('Meyve ve Sebze', 'et-tavuk-ve-balik')).toBe('food-steak');
  });

  it('icon_key yokken Türkçe adla eskisi gibi çalışır (eski sunucu)', () => {
    expect(getCategoryIcon('Meyve ve Sebze')).toBe('fruit-watermelon');
  });

  it('bilinmeyen anahtar ada düşer, ad da tutmazsa varsayılana', () => {
    expect(getCategoryIcon('Meyve ve Sebze', 'bilinmeyen-slug')).toBe('fruit-watermelon');
    expect(getCategoryIcon('Zzz', 'bilinmeyen-slug')).toBe(DEFAULT_ICON);
  });

  it('boş girdilerde patlamaz', () => {
    expect(getCategoryIcon(null)).toBe(DEFAULT_ICON);
    expect(getCategoryIcon(undefined, null)).toBe(DEFAULT_ICON);
    expect(getCategoryIcon('', '')).toBe(DEFAULT_ICON);
  });

  it('her kanonik üst kategori AYIRT EDİCİ bir simge alır', () => {
    // Tek bir simgeye düşen iki üst kategori, kullanıcı için "aynı şey"
    // demek — bu eşlemenin var olma sebebi tam olarak bunu önlemek.
    const KEYS = [
      'sut-urunleri-ve-kahvaltilik', 'et-tavuk-ve-balik', 'meyve-ve-sebze',
      'temel-gida', 'firin-ve-pastane', 'icecek', 'atistirmalik-ve-tatli',
      'dondurma', 'hazir-yemek-ve-donuk', 'temizlik-ve-kisisel-bakim-urunleri',
      'bebek', 'ev-pet-ve-yasam', 'saglik-ve-kozmetik', 'diger-urunler',
    ];
    const icons = KEYS.map((k) => getCategoryIcon(null, k));
    expect(icons).not.toContain(DEFAULT_ICON);
    expect(new Set(icons).size).toBe(KEYS.length);
  });
});
