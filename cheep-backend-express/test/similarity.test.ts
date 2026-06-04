import { describe, it, expect } from 'vitest';
import {
    levenshteinDistance,
    calculateSimilarity,
    jaccardSimilarity,
} from '../src/utils/similarity';

describe('levenshteinDistance', () => {
    it('aynı stringler için 0 döner', () => {
        expect(levenshteinDistance('sut', 'sut')).toBe(0);
    });

    it('tek karakter farkını ölçer', () => {
        expect(levenshteinDistance('sut', 'sat')).toBe(1);
    });

    it('boş stringe uzaklık = diğerinin uzunluğu', () => {
        expect(levenshteinDistance('', 'pinar')).toBe(5);
        expect(levenshteinDistance('pinar', '')).toBe(5);
    });

    it('ekleme/silme/değiştirme kombinasyonunu hesaplar', () => {
        expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });
});

describe('calculateSimilarity', () => {
    it('aynı stringler için 1.0 döner', () => {
        expect(calculateSimilarity('pinar sut', 'pinar sut')).toBe(1);
    });

    it('iki boş string için 1.0 döner', () => {
        expect(calculateSimilarity('', '')).toBe(1);
    });

    it('benzer stringler için yüksek skor verir', () => {
        const score = calculateSimilarity('pinar sut 1l', 'pinar sut 1 l');
        expect(score).toBeGreaterThan(0.8);
    });

    it('alakasız stringler için düşük skor verir', () => {
        const score = calculateSimilarity('domates', 'deterjan xyz');
        expect(score).toBeLessThan(0.5);
    });

    it('0 ile 1 arasında bir değer döndürür', () => {
        const score = calculateSimilarity('abc', 'abd');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
    });
});

describe('jaccardSimilarity', () => {
    it('birebir aynı kelime kümeleri için 1 döner', () => {
        expect(jaccardSimilarity('tam yagli sut', 'tam yagli sut')).toBe(1);
    });

    it('hiç ortak kelime yoksa 0 döner', () => {
        expect(jaccardSimilarity('domates salca', 'beyaz peynir')).toBe(0);
    });

    it('kısmi örtüşmeyi oran olarak hesaplar', () => {
        // {a,b,c} vs {b,c,d}: kesişim {b,c}=2, birleşim {a,b,c,d}=4 => 0.5
        expect(jaccardSimilarity('a b c', 'b c d')).toBe(0.5);
    });

    it('kelime sırasından bağımsızdır', () => {
        expect(jaccardSimilarity('sut pinar', 'pinar sut')).toBe(1);
    });
});
