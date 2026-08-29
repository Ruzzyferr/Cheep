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

/**
 * ÜRETİMDE GERÇEKTEN DÖNEN kanonik üst kategoriler.
 *
 * Elle tutuluyor çünkü test ağa çıkmıyor. Tazelemek için:
 *   curl -s https://api.cheep.live/api/v1/categories/parent?country=HR  *     | jq -r '.data[].icon_key'
 *
 * Bu liste olmadan eksik bir anahtar SESSİZ kalıyor: `kisisel-bakim` ve
 * `temizlik-urunleri` ilk yazımda atlanmıştı ve iki kategori üretimde genel
 * etikete düşüyordu — hiçbir test kırılmadı, ancak üretim yanıtı elle
 * karşılaştırılınca fark edildi.
 */
const CANONICAL_TOP_LEVEL = [
  'sut-urunleri-ve-kahvaltilik',
  'et-tavuk-ve-balik',
  'meyve-ve-sebze',
  'temel-gida',
  'icecek',
  'atistirmalik-ve-tatli',
  'kisisel-bakim',
  'temizlik-urunleri',
  'diger-urunler',
];

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
    const icons = CANONICAL_TOP_LEVEL.map((k) => getCategoryIcon(null, k));
    expect(icons).not.toContain(DEFAULT_ICON);
    expect(new Set(icons).size).toBe(CANONICAL_TOP_LEVEL.length);
  });
});

/**
 * YAPRAK KATEGORİLER.
 *
 * Ürün kartları kategoriyi yaprak düzeyinde taşıyor (`gofret`, `dus-jeli`,
 * `kirmizi-et`…) ve bunlar üst-kategori tablosunda YOK. HR/HU/RO
 * kaynaklarında ÜRÜN GÖRSELİ olmadığı için kartların tamamı simge gösteriyor;
 * hepsi aynı simgeye düşünce katalog ölü görünüyordu.
 *
 * Aşağıdaki sluglar üretim veritabanındaki EN ÇOK ÜRÜNLÜ yapraklardan
 * alındı (ürün sayısına göre ilk ~40).
 */
describe('getCategoryIcon — yaprak kategoriler', () => {
  const CASES: [string, string][] = [
    ['peynir', 'cheese'],
    ['yogurt', 'cheese'],
    ['sut', 'cheese'],
    ['sebze', 'fruit-watermelon'],
    ['meyve', 'fruit-watermelon'],
    ['zeytin', 'fruit-watermelon'],
    ['sarkuteri', 'food-steak'],
    ['kirmizi-et', 'food-steak'],
    ['tavuk', 'food-steak'],
    ['balik', 'food-steak'],
    ['cikolata', 'cookie'],
    ['gofret', 'cookie'],
    ['biskuvi-ve-kraker', 'cookie'],
    ['cips', 'cookie'],
    ['kahve', 'bottle-soda-classic'],
    ['cay', 'bottle-soda-classic'],
    ['meyve-suyu', 'bottle-soda-classic'],
    ['su', 'bottle-soda-classic'],
    ['ekmek', 'bread-slice'],
    ['kek', 'bread-slice'],
    ['makarna', 'rice'],
    ['baharat', 'rice'],
    ['salca', 'rice'],
    ['bakliyat', 'rice'],
    ['dus-jeli', 'lotion'],
    ['sampuan', 'lotion'],
    ['deodorant', 'lotion'],
    ['cilt-bakim', 'lotion'],
    ['yuzey-temizleyici', 'spray-bottle'],
    ['camasir-deterjani', 'spray-bottle'],
    ['bebek-mamasi', 'baby-carriage'],
    ['dondurma', 'ice-cream'],
    ['dondurulmus-gida', 'fridge-outline'],
    ['dondurulmus-sebze', 'fridge-outline'],
    ['hazir-yemek', 'fridge-outline'],
  ];

  it.each(CASES)('%s -> %s', (slug, icon) => {
    expect(getCategoryIcon(null, slug)).toBe(icon);
  });

  it('dondurulmus-* ile dondurma KARISMAZ', () => {
    // İkisi de "dondur" ile başlıyor ama farklı şeyler: biri donuk reyon,
    // diğeri tatlı. Sıra yanlış olsa dondurulmuş sebze dondurma sayılırdı.
    expect(getCategoryIcon(null, 'dondurma')).toBe('ice-cream');
    expect(getCategoryIcon(null, 'dondurulmus-sebze')).toBe('fridge-outline');
  });

  it('hiçbir yaprak varsayılana düşmüyor', () => {
    const icons = CASES.map(([slug]) => getCategoryIcon(null, slug));
    expect(icons).not.toContain(DEFAULT_ICON);
  });
});
