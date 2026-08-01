import { describe, it, expect } from 'vitest';
import { CATEGORY_PL, localizeCategory } from '../src/config/category-locale.js';

describe('localizeCategory', () => {
    it('PL için kategoriyi çevirir', () => {
        expect(localizeCategory('PL', 'Çikolata', 'cikolata')).toEqual({ name: 'Czekolada', slug: 'czekolada' });
        expect(localizeCategory('PL', 'Kedi Maması', 'kedi-mamasi')).toEqual({
            name: 'Karma dla kotów',
            slug: 'karma-dla-kotow',
        });
    });

    it('TR için dokunmaz', () => {
        expect(localizeCategory('TR', 'Çikolata', 'cikolata')).toEqual({ name: 'Çikolata', slug: 'cikolata' });
    });

    it('eşleme yoksa Türkçesini döner — sayfa kaybolmasın', () => {
        expect(localizeCategory('PL', 'Yeni Kategori', 'yeni-kategori')).toEqual({
            name: 'Yeni Kategori',
            slug: 'yeni-kategori',
        });
    });

    it('Lehçe slug\'lar URL-güvenli: aksan ve boşluk yok', () => {
        for (const [trSlug, pl] of Object.entries(CATEGORY_PL)) {
            expect(pl.slug, `${trSlug} → ${pl.slug}`).toMatch(/^[a-z0-9-]+$/);
            expect(pl.name.length).toBeGreaterThan(1);
        }
    });

    it('Lehçe slug\'lar birbirinden farklı — çakışma sayfa yutar', () => {
        const slugs = Object.values(CATEGORY_PL).map((c) => c.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });
});
