import { describe, it, expect } from 'vitest';
import { slugify, productSlug, uniqueSlug } from '../src/utils/slug.js';

describe('slugify', () => {
    it('Türkçe karakterleri doğru sadeleştirir', () => {
        expect(slugify('Ülker Çikolatalı Gofret')).toBe('ulker-cikolatali-gofret');
        expect(slugify('Sütaş Tam Yağlı Süt')).toBe('sutas-tam-yagli-sut');
        // 'ı' harfi hazır kütüphanelerin çoğunda düşüyor — burada düşmemeli.
        expect(slugify('Işıl Ilık Sıcak')).toBe('isil-ilik-sicak');
    });

    it('Lehçe karakterleri doğru sadeleştirir', () => {
        expect(slugify('Mleko Łaciate')).toBe('mleko-laciate');
        expect(slugify('Jajka świeże ćwiartki')).toBe('jajka-swieze-cwiartki');
        expect(slugify('Zdrowa Żywność')).toBe('zdrowa-zywnosc');
    });

    it('rakam ve birimleri korur', () => {
        expect(slugify('Süt 1 L')).toBe('sut-1-l');
        expect(slugify('Gofret 36g')).toBe('gofret-36g');
    });

    it('yüzde ve ve işaretini okunur hale getirir', () => {
        expect(slugify('Mleko 3,2%')).toBe('mleko-3-2-yuzde');
        expect(slugify('Tuz & Biber')).toBe('tuz-ve-biber');
    });

    it('ayraçları tekilleştirir, baştaki ve sondaki tireyi atar', () => {
        expect(slugify('  --Süt///Ayran--  ')).toBe('sut-ayran');
    });

    it('boş girdide boş döner', () => {
        expect(slugify('')).toBe('');
        expect(slugify('!!!')).toBe('');
    });

    it('uzun adları kırpar ve sonda tire bırakmaz', () => {
        const s = slugify('a'.repeat(50) + ' ' + 'b'.repeat(50));
        expect(s.length).toBeLessThanOrEqual(80);
        expect(s.endsWith('-')).toBe(false);
    });
});

describe('productSlug', () => {
    it('markayı öne ekler', () => {
        expect(productSlug('Çikolatalı Gofret 36g', 'Ülker')).toBe('ulker-cikolatali-gofret-36g');
    });

    it('marka isimde zaten varsa tekrarlamaz', () => {
        expect(productSlug('Ülker Çikolatalı Gofret', 'Ülker')).toBe('ulker-cikolatali-gofret');
    });

    it('marka yoksa sadece ismi kullanır', () => {
        expect(productSlug('Çikolatalı Gofret', null)).toBe('cikolatali-gofret');
    });
});

describe('uniqueSlug', () => {
    it('çakışmayan slug\'ı olduğu gibi bırakır', () => {
        const taken = new Set<string>();
        expect(uniqueSlug('sut-1l', 5, taken)).toBe('sut-1l');
    });

    it('çakışmada id ekler', () => {
        const taken = new Set<string>(['sut-1l']);
        expect(uniqueSlug('sut-1l', 42, taken)).toBe('sut-1l-42');
    });

    it('boş slug için id tabanlı ad üretir', () => {
        const taken = new Set<string>();
        expect(uniqueSlug('', 7, taken)).toBe('urun-7');
    });

    it('verdiği slug\'ı kümeye ekler, aynı tur içinde tekrar üretmez', () => {
        const taken = new Set<string>();
        expect(uniqueSlug('peynir', 1, taken)).toBe('peynir');
        expect(uniqueSlug('peynir', 2, taken)).toBe('peynir-2');
    });
});
