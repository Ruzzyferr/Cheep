import { describe, it, expect } from 'vitest';
import { param, intParam } from '../src/utils/request-params.js';

/**
 * Express 5.2 ile `req.params` değerleri `string | string[]` oldu. Bu yardımcı
 * tipi daraltıyor; davranışın tekil parametrede eskisiyle birebir aynı kalması
 * gerekiyor — 30+ controller çağrısı buna bağlı.
 */
describe('rota parametresi daraltma', () => {
    it('tekil string’i olduğu gibi verir', () => {
        expect(param('42')).toBe('42');
        expect(intParam('42')).toBe(42);
    });

    it('dizi gelirse ilk öğeyi alır (çökmez)', () => {
        expect(param(['7', '9'])).toBe('7');
        expect(intParam(['7', '9'])).toBe(7);
    });

    it('undefined’ı boş string’e indirger, intParam NaN döner', () => {
        expect(param(undefined)).toBe('');
        expect(Number.isNaN(intParam(undefined))).toBe(true);
    });

    it('sayısal olmayanda NaN — çağıran doğrulamayı yapar', () => {
        expect(Number.isNaN(intParam('abc'))).toBe(true);
    });

    it('parseInt ile aynı taban-10 davranışı (baştaki sıfırlar sekizlik değil)', () => {
        expect(intParam('011')).toBe(11);
        expect(intParam('12abc')).toBe(12);
    });
});
