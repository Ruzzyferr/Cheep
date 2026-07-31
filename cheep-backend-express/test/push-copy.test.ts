import { describe, it, expect } from 'vitest';
import { buildPushCopy, resolveLocale } from '../src/api/notifications/push-copy.js';

describe('push metni dil seçimi', () => {
    it('desteklenen dilleri tanır', () => {
        expect(resolveLocale('tr')).toBe('tr');
        expect(resolveLocale('pl-PL')).toBe('pl');
        expect(resolveLocale('DE')).toBe('de');
    });

    it('bilinmeyen dilde İngilizce’ye düşer, Türkçe’ye DEĞİL', () => {
        // TR bilmeyen kullanıcıya Türkçe bildirim göndermek İngilizce'den kötü.
        expect(resolveLocale('fr')).toBe('en');
        expect(resolveLocale(null)).toBe('en');
        expect(resolveLocale('')).toBe('en');
    });
});

describe('push metni', () => {
    it('tek üründe ürün adını ve yüzdeyi yazar', () => {
        const c = buildPushCopy('tr', [{ productName: 'Süt 1L', dropPct: 12.4 }]);
        expect(c.body).toContain('Süt 1L');
        expect(c.body).toContain('12'); // yuvarlanır
    });

    it('çok üründe tek özet mesaj verir — bildirim yığını oluşturmamak için', () => {
        const c = buildPushCopy('tr', [
            { productName: 'Süt', dropPct: 10 },
            { productName: 'Yumurta', dropPct: 8 },
            { productName: 'Ekmek', dropPct: 6 },
        ]);
        expect(c.body).toContain('3');
        expect(c.body).not.toContain('Yumurta');
    });

    it('her dil için başlık ve gövde üretir', () => {
        for (const l of ['tr', 'en', 'de', 'pl', 'sv'] as const) {
            const one = buildPushCopy(l, [{ productName: 'X', dropPct: 10 }]);
            const many = buildPushCopy(l, [{ productName: 'X', dropPct: 10 }, { productName: 'Y', dropPct: 9 }]);
            expect(one.title.length).toBeGreaterThan(0);
            expect(one.body.length).toBeGreaterThan(0);
            expect(many.body).toContain('2');
        }
    });
});
