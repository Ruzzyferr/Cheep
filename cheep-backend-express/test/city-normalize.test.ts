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
        // Ne il ne de bilinen bir ilçe: biçimi düzeltilip olduğu gibi geçer.
        // (Kapaklı ve Lüleburgaz artık ile eşleniyor, bkz. aşağıdaki blok.)
        expect(normalizeCity('kuşcenneti')).toBe('Kuşcenneti');
        expect(normalizeCity('YEŞİLKÖY')).toBe('Yeşilköy');
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

describe('normalizeCity — ile bağlı olmayan yerleşim adları', () => {
    /**
     * Bazı şube kayıtlarında yalnızca ilçe/belde adı var, "ilçe/il" biçimi yok
     * ve `address` alanı boş. Bu adlar il listesinde bulunamadığı için kendi
     * başlarına birer "şehir" sayfası açıyordu: "Büyükkarıştıran market
     * fiyatları" gibi 6 şubelik sayfalar, bağlı oldukları ilin sayfasını
     * güçlendirmek yerine ondan pay çalıyordu.
     *
     * Eşleme, gerçek şube KOORDİNATLARINDAN doğrulandı — ad benzerliğinden
     * değil. Örneğin Altınova adı Yalova'nın bir ilçesini çağrıştırıyor ama
     * verideki kayıtlar (40.94, 27.48) Tekirdağ'da.
     */
    it('bilinen ilçe/beldeyi bağlı olduğu ile çevirir', () => {
        expect(normalizeCity('Kapaklı')).toBe('Tekirdağ');
        expect(normalizeCity('Lüleburgaz')).toBe('Kırklareli');
        expect(normalizeCity('Büyükkarıştıran')).toBe('Kırklareli');
        expect(normalizeCity('Akbük')).toBe('Aydın');
        expect(normalizeCity('Altınova')).toBe('Tekirdağ');
    });

    it('büyük/küçük harf ve aksan farkını yine tolere eder', () => {
        expect(normalizeCity('KAPAKLI')).toBe('Tekirdağ');
        expect(normalizeCity('luleburgaz')).toBe('Kırklareli');
    });

    it('ilçe/il biçimi verilmişse il yine kazanır', () => {
        // "Kapaklı/Tekirdağ" zaten doğru; eşleme onu bozmamalı.
        expect(normalizeCity('Kapaklı/Tekirdağ')).toBe('Tekirdağ');
    });

    it('bilinmeyen yerleşim adı OLDUĞU GİBİ geçer — sayfa kaybolmasın', () => {
        expect(normalizeCity('Bilinmeyenköy')).toBe('Bilinmeyenköy');
    });

    it('yalnızca TR için uygulanır', () => {
        expect(normalizeCity('Kapaklı', 'PL')).toBe('Kapaklı');
    });
});

