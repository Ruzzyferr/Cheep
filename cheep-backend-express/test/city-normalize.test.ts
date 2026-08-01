import { describe, it, expect } from 'vitest';
import { normalizeCity } from '../src/config/city-normalize.js';

describe('normalizeCity', () => {
    it('ilçe/il biçiminden ili alır — Ankara altı sayfaya bölünmesin', () => {
        expect(normalizeCity('Keçiören/Ankara')).toBe('Ankara');
        expect(normalizeCity('Çankaya/Ankara')).toBe('Ankara');
        expect(normalizeCity('Merkezefendi/Denizli')).toBe('Denizli');
        expect(normalizeCity('Kadıköy /  İstanbul')).toBe('İstanbul');
    });

    it('aksansız ASCII yazımı doğru ile eşler', () => {
        // Bunlar gerçek veride var ve kural tabanlı dönüşüm birini mutlaka bozar:
        // 'Istanbul' → İstanbul ama 'Isparta' gerçekten I ile başlıyor.
        expect(normalizeCity('Istanbul')).toBe('İstanbul');
        expect(normalizeCity('Izmir')).toBe('İzmir');
        expect(normalizeCity('Isparta')).toBe('Isparta');
        expect(normalizeCity('Iğdır')).toBe('Iğdır');
    });

    it('büyük/küçük harf farkını yutar — aynı şehir tek sayfa', () => {
        for (const v of ['istanbul', 'İstanbul', 'ISTANBUL', 'İSTANBUL']) {
            expect(normalizeCity(v), v).toBe('İstanbul');
        }
        expect(normalizeCity('ADANA')).toBe('Adana');
        expect(normalizeCity('KOCAELİ')).toBe('Kocaeli');
        expect(normalizeCity('GÜMÜŞHANE')).toBe('Gümüşhane');
    });

    it('listede olmayan adı da düzgün biçimlendirir — sayfa kaybolmasın', () => {
        expect(normalizeCity('kapaklı')).toBe('Kapaklı');
        expect(normalizeCity('LÜLEBURGAZ')).toBe('Lüleburgaz');
    });

    it('Polonya için il tablosu uygulanmaz', () => {
        expect(normalizeCity('warszawa', 'PL')).toBe('Warszawa');
        expect(normalizeCity('KRAKÓW', 'PL')).toBe('Kraków');
    });

    it('boş ve anlamsız değerleri eler', () => {
        expect(normalizeCity(null)).toBeNull();
        expect(normalizeCity('')).toBeNull();
        expect(normalizeCity('X')).toBeNull();
    });
});
