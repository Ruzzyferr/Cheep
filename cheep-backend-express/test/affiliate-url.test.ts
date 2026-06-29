import { describe, it, expect } from 'vitest';
import {
    normalizeStoreKey,
    resolveKnownStoreUrl,
    searchFallbackUrl,
    buildStoreUrl,
} from '../src/services/affiliate-url';

describe('normalizeStoreKey', () => {
    it('Türkçe karakterleri ASCII\'ye indirger ve küçük harfe çevirir', () => {
        expect(normalizeStoreKey('ŞOK')).toBe('sok');
        expect(normalizeStoreKey('Migros')).toBe('migros');
        expect(normalizeStoreKey('CarrefourSA')).toBe('carrefoursa');
    });
    it('noktalama ve fazla boşlukları temizler', () => {
        expect(normalizeStoreKey('A-101  ')).toBe('a 101');
    });
});

describe('resolveKnownStoreUrl', () => {
    it('bilinen zincirleri eşler', () => {
        expect(resolveKnownStoreUrl('Migros')).toBe('https://www.migros.com.tr/');
        expect(resolveKnownStoreUrl('CarrefourSA')).toBe('https://www.carrefoursa.com/');
        expect(resolveKnownStoreUrl('ŞOK')).toBe('https://www.sokmarket.com.tr/');
    });
    it('kısmî eşleşmeyi yakalar (ör. "Migros Jet")', () => {
        expect(resolveKnownStoreUrl('Migros Jet')).toBe('https://www.migros.com.tr/');
    });
    it('tanınmayan mağaza için null', () => {
        expect(resolveKnownStoreUrl('Bilinmeyen Bakkal')).toBeNull();
    });
});

describe('searchFallbackUrl', () => {
    it('mağaza ve ürünü içeren geçerli bir arama URL\'si üretir', () => {
        const url = searchFallbackUrl('Bakkal X', 'Süt 1L');
        expect(url.startsWith('https://www.google.com/search?q=')).toBe(true);
        expect(url).toContain(encodeURIComponent('Bakkal X Süt 1L online market'));
    });
});

describe('buildStoreUrl — öncelik sırası', () => {
    it('DB website_url varsa onu kullanır', () => {
        expect(buildStoreUrl('Migros', 'https://ozel.migros.com.tr/sepet')).toBe(
            'https://ozel.migros.com.tr/sepet'
        );
    });
    it('geçersiz website_url yok sayılır, bilinen zincire düşer', () => {
        expect(buildStoreUrl('Migros', 'javascript:alert(1)')).toBe('https://www.migros.com.tr/');
    });
    it('website yoksa bilinen zinciri kullanır', () => {
        expect(buildStoreUrl('A101')).toBe('https://www.a101.com.tr/');
    });
    it('hiçbiri yoksa arama yedeğine düşer', () => {
        const url = buildStoreUrl('Bilinmeyen Market', null, 'Yumurta');
        expect(url.startsWith('https://www.google.com/search?q=')).toBe(true);
    });
});
