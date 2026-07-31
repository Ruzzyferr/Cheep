import { describe, it, expect } from 'vitest';
import { capPerUser, MIN_DROP_PCT, MAX_PER_USER } from '../src/api/notifications/price-drop.service.js';

const c = (user_id: number, product_id: number, drop_pct: number) =>
    ({ user_id, product_id, drop_pct, country_id: 1, store_id: 1, old_price: 10 as any, new_price: 9 as any });

describe('fiyat düşüşü — kullanıcı başına üst sınır', () => {
    it('kullanıcı başına en fazla MAX_PER_USER bildirim bırakır', () => {
        const rows = Array.from({ length: 12 }, (_, i) => c(1, i, 50 - i));
        const out = capPerUser(rows);
        expect(out).toHaveLength(MAX_PER_USER);
    });

    it('en büyük düşüşleri tutar (sorgu azalan sıralı geldiği için ilk N)', () => {
        const rows = [c(1, 10, 40), c(1, 11, 30), c(1, 12, 20), c(1, 13, 10), c(1, 14, 9), c(1, 15, 8)];
        const out = capPerUser(rows, 3);
        expect(out.map((r) => r.product_id)).toEqual([10, 11, 12]);
    });

    it('kullanıcıları birbirinden bağımsız sayar', () => {
        const rows = [c(1, 1, 30), c(1, 2, 20), c(2, 3, 25), c(2, 4, 15), c(3, 5, 10)];
        const out = capPerUser(rows, 1);
        expect(out.map((r) => [r.user_id, r.product_id])).toEqual([[1, 1], [2, 3], [3, 5]]);
    });

    it('boş girdide boş döner', () => {
        expect(capPerUser([])).toEqual([]);
    });
});

describe('eşikler', () => {
    it('yüzde eşiği kullanılıyor — para birimi bağımsız olsun diye', () => {
        // TRY ve PLN için ayrı mutlak eşik tanımlamak zorunda kalmamak adına.
        expect(MIN_DROP_PCT).toBeGreaterThan(0);
        expect(MIN_DROP_PCT).toBeLessThan(100);
    });

    it('kullanıcı başına sınır makul — spam koruması', () => {
        expect(MAX_PER_USER).toBeGreaterThan(0);
        expect(MAX_PER_USER).toBeLessThanOrEqual(10);
    });
});
