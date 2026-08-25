/**
 * Karşılaştırma sıralamasının KAPSAM garantisi.
 *
 * Üretimde yaşanan hata: 11 ürünlük bir listede Migros yalnızca 4 ürünü
 * taşıyordu ama 620 TL ile "en ucuz" göründüğü için BİRİNCİ sıradaydı; 11
 * ürünün hepsini taşıyan A101+BİM+CarrefourSA rotası (1.782 TL) BEŞİNCİ
 * sıradaydı. Kullanıcı "en ucuz rota"yı açıp Migros'a gidiyor ve listesinin
 * 7 kalemi eksik dönüyordu.
 *
 * Kök neden ikiydi ve ikisi de burada sınanıyor:
 *  ① Fiyat kovası (40 puan) HAM toplam üzerinden normalize ediliyordu. Eksik
 *    ürünü olan sepet, taşımadığı şeyin parasını ödemediği için otomatik
 *    olarak en ucuzdu ve kovanın tamamını süpürüyordu; kapsam kovası ise en
 *    fazla 25 puan verebiliyordu. Yani eksik sepet yapısal olarak kazanıyordu.
 *  ② Belgelenen "ürün atlayan ucuz rota tam sepeti asla geçemez" sözü, skor
 *    toplamına bırakılmıştı — mesafe + market sayısı kovaları (25 puan) tek
 *    başına bu sözü bozmaya yetiyordu.
 */
import { describe, it, expect } from 'vitest';
import {
    sortStrategies,
    imputedTotal,
    buildCheapestUnitPrices,
} from '../src/services/compare-engine.service.js';

/** Test stratejisi kurar: verilen kalemleri taşır, verilenleri eksik bırakır. */
function strategy(opts: {
    type?: 'single_store' | 'multi_store';
    storeNames: string[];
    carried: Array<{ listItemId: number; qty: number; unitPrice: number }>;
    missing: Array<{ listItemId: number; qty: number }>;
    distance?: number;
}): any {
    const carried = opts.carried;
    const totalPrice = carried.reduce((s, c) => s + c.unitPrice * c.qty, 0);
    const totalItems = carried.length + opts.missing.length;
    return {
        type: opts.type ?? (opts.storeNames.length > 1 ? 'multi_store' : 'single_store'),
        stores: opts.storeNames.map((name, i) => ({
            store: { id: i + 1, name, lat: null, lon: null },
            // Tüm taşınan kalemler ilk markete konur; sayım için yeterli.
            products: i === 0
                ? carried.map(c => ({
                      listItemId: c.listItemId,
                      product: { id: c.listItemId, name: `p${c.listItemId}`, brand: null, image_url: null },
                      quantity: c.qty, unit: 'adet',
                      pricePerUnit: c.unitPrice, totalPrice: c.unitPrice * c.qty,
                  }))
                : [],
            subtotal: i === 0 ? totalPrice : 0,
        })),
        totalPrice,
        totalDistance: opts.distance ?? 0,
        estimatedDuration: 0,
        missingProducts: opts.missing.map(m => ({
            listItemId: m.listItemId,
            product: { id: m.listItemId, name: `p${m.listItemId}`, brand: null },
            quantity: m.qty, unit: 'adet',
        })),
        coveragePercentage: Math.round((carried.length / totalItems) * 100),
        budgetStatus: 'unknown' as const,
        budgetRemaining: null,
        hasFavoriteStores: false,
        favoriteStoreCount: 0,
        score: 0,
    };
}

describe('imputedTotal', () => {
    it('eksik ürünleri başka yerdeki en ucuz fiyatıyla toplama ekler', () => {
        const s = strategy({
            storeNames: ['Migros'],
            carried: [{ listItemId: 1, qty: 1, unitPrice: 100 }],
            missing: [{ listItemId: 2, qty: 3 }],
        });
        const cheapest = new Map([[1, 100], [2, 20]]);
        // 100 (taşınan) + 20×3 (eksik olanın başka yerdeki fiyatı) = 160
        expect(imputedTotal(s, cheapest)).toBe(160);
    });

    it('hiçbir markette olmayan ürün toplamı şişirmez', () => {
        const s = strategy({
            storeNames: ['Migros'],
            carried: [{ listItemId: 1, qty: 1, unitPrice: 100 }],
            missing: [{ listItemId: 99, qty: 5 }], // haritada yok
        });
        expect(imputedTotal(s, new Map([[1, 100]]))).toBe(100);
    });
});

describe('buildCheapestUnitPrices', () => {
    it('kalem başına en ucuz birim fiyatı seçer, hiç seçeneği olmayanı atlar', () => {
        const listItems = [{ id: 1 }, { id: 2 }, { id: 3 }] as any;
        const itemOptions = new Map<number, Map<number, any>>([
            [1, new Map([[10, { price: 50 }], [20, { price: 35 }], [30, { price: 90 }]])],
            [2, new Map([[10, { price: 7 }]])],
            [3, new Map()], // hiçbir markette yok
        ]);
        const out = buildCheapestUnitPrices(listItems, itemOptions as any);
        expect(out.get(1)).toBe(35);
        expect(out.get(2)).toBe(7);
        expect(out.has(3)).toBe(false);
    });
});

describe('sortStrategies — kapsam garantisi', () => {
    // Üretimdeki vakanın sadeleştirilmiş hâli: 4 kalemin 3'ünü taşımayan ucuz
    // market, hepsini taşıyan pahalı rotayla yarışıyor.
    const cheapest = new Map([[1, 100], [2, 200], [3, 300], [4, 400]]);

    const eksikAmaUcuz = strategy({
        storeNames: ['Migros'],
        carried: [{ listItemId: 1, qty: 1, unitPrice: 100 }],
        missing: [{ listItemId: 2, qty: 1 }, { listItemId: 3, qty: 1 }, { listItemId: 4, qty: 1 }],
        distance: 0.5, // hemen yanı başında — mesafe kovasını da kazanır
    });
    const tamSepet = strategy({
        storeNames: ['A101', 'BİM', 'CarrefourSA'],
        carried: [
            { listItemId: 1, qty: 1, unitPrice: 110 },
            { listItemId: 2, qty: 1, unitPrice: 210 },
            { listItemId: 3, qty: 1, unitPrice: 310 },
            { listItemId: 4, qty: 1, unitPrice: 410 },
        ],
        missing: [],
        distance: 12, // uzak — mesafe ve market sayısı kovalarını kaybeder
    });

    it('TAM sepet, daha ucuz ama eksik rotayı HER ZAMAN geçer', () => {
        const sorted = sortStrategies([eksikAmaUcuz, tamSepet], [], cheapest);
        expect(sorted[0].coveragePercentage).toBe(100);
        expect(sorted[0].stores.map((s: any) => s.store.name)).toContain('A101');
    });

    it('sıralama giriş sırasından bağımsızdır', () => {
        const a = sortStrategies([eksikAmaUcuz, tamSepet], [], cheapest);
        const b = sortStrategies([tamSepet, eksikAmaUcuz], [], cheapest);
        expect(a[0].coveragePercentage).toBe(b[0].coveragePercentage);
        expect(a[0].coveragePercentage).toBe(100);
    });

    it('eksik sepet, ham fiyatıyla değil KIYASLANABİLİR fiyatıyla puanlanır', () => {
        // İki eksik strateji: A ucuz görünür ama eksikleri pahalı; B'nin tersi.
        const ucuzGorunen = strategy({
            storeNames: ['A'],
            carried: [{ listItemId: 1, qty: 1, unitPrice: 100 }],
            missing: [{ listItemId: 4, qty: 1 }], // başka yerde 400
        });
        const pahaliGorunen = strategy({
            storeNames: ['B'],
            carried: [{ listItemId: 4, qty: 1, unitPrice: 400 }],
            missing: [{ listItemId: 1, qty: 1 }], // başka yerde 100
        });
        // İkisinin de kıyaslanabilir toplamı 500 — yani gerçekte eşit pahalı.
        expect(imputedTotal(ucuzGorunen, cheapest)).toBe(500);
        expect(imputedTotal(pahaliGorunen, cheapest)).toBe(500);
        const sorted = sortStrategies([ucuzGorunen, pahaliGorunen], [], cheapest);
        // Ham fiyat kullanılsaydı A (100 TL) B'yi (400 TL) ezici farkla geçerdi.
        expect(Math.abs(sorted[0].score - sorted[1].score)).toBeLessThanOrEqual(1);
    });

    it('iki tam sepet arasında ucuz olan kazanır', () => {
        const ucuzTam = strategy({
            storeNames: ['Ucuz'],
            carried: [
                { listItemId: 1, qty: 1, unitPrice: 100 }, { listItemId: 2, qty: 1, unitPrice: 200 },
                { listItemId: 3, qty: 1, unitPrice: 300 }, { listItemId: 4, qty: 1, unitPrice: 400 },
            ],
            missing: [], distance: 3,
        });
        const sorted = sortStrategies([tamSepet, ucuzTam], [], cheapest);
        expect(sorted[0].stores[0].store.name).toBe('Ucuz');
    });

    it('uzun listede eksik cezası tüm skorları sıfıra yapıştırmaz', () => {
        // Eski sabit ceza (adet × 5) burada -100 veriyordu → her strateji 0.
        const uzunListe = new Map<number, number>();
        for (let i = 1; i <= 40; i++) uzunListe.set(i, 10);
        const yirmiEksik = strategy({
            storeNames: ['X'],
            carried: Array.from({ length: 20 }, (_, i) => ({ listItemId: i + 1, qty: 1, unitPrice: 10 })),
            missing: Array.from({ length: 20 }, (_, i) => ({ listItemId: i + 21, qty: 1 })),
        });
        const otuzEksik = strategy({
            storeNames: ['Y'],
            carried: Array.from({ length: 10 }, (_, i) => ({ listItemId: i + 1, qty: 1, unitPrice: 10 })),
            missing: Array.from({ length: 30 }, (_, i) => ({ listItemId: i + 11, qty: 1 })),
        });
        const sorted = sortStrategies([otuzEksik, yirmiEksik], [], uzunListe);
        expect(sorted[0].score).toBeGreaterThan(0);
        // Daha çok kapsayan önde olmalı — ikisi de eksik olduğu için skor karar verir.
        expect(sorted[0].stores[0].store.name).toBe('X');
    });
});
