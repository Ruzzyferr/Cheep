import { describe, it, expect } from 'vitest';
import {
    subtreeIds,
    resolveOwners,
    countryProductTotals,
    type CategoryNode,
    type CategoryProductCount,
} from '../src/services/category-ownership.js';

/**
 * Bu modül taksonomi birleştirmesinin BEYNİ: hangi kategori hangi ülkeye ait,
 * hangisi bölünmeli, hangisi silinmeli. Veritabanına dokunmadan test edilebilsin
 * diye saf tutuldu — migration'ı canlıda denemek tek seçenek olmasın.
 */

// Gerçek yapının küçültülmüş bir örneği:
//   1 sut-urunleri-ve-kahvaltilik (TR ağacı)
//     └─ 2 peynir           → yarım kalmış migration bunu 89'un altına taşımıştı
//   89 sut-urunleri (PL ağacı)
//     ├─ 90 sut
//     └─ 2  peynir          (hem TR hem PL ürünü var → bölünmeli)
//   20 meyve-ve-sebze (ölü kabuk: ürün yok, çocuk yok)
const NODES: CategoryNode[] = [
    { id: 1, slug: 'sut-urunleri-ve-kahvaltilik', parent_id: null },
    { id: 89, slug: 'sut-urunleri', parent_id: null },
    { id: 90, slug: 'sut', parent_id: 89 },
    { id: 2, slug: 'peynir', parent_id: 89 },
    { id: 20, slug: 'meyve-ve-sebze', parent_id: null },
];

const TR = 1;
const PL = 2;

describe('subtreeIds', () => {
    it('yaprak için yalnızca kendisini döner', () => {
        expect(subtreeIds(NODES, 90)).toEqual([90]);
    });

    it('kökü ve tüm çocuklarını döner', () => {
        expect(subtreeIds(NODES, 89).sort((a, b) => a - b)).toEqual([2, 89, 90]);
    });

    it('çocuğu olmayan kökü tek başına döner', () => {
        expect(subtreeIds(NODES, 20)).toEqual([20]);
    });

    it('bilinmeyen id için boş döner — çağıran patlamasın', () => {
        expect(subtreeIds(NODES, 999)).toEqual([]);
    });

    it('parent döngüsünde sonsuza gitmez', () => {
        // Bozuk veri: 100 ↔ 101 birbirinin çocuğu. Gerçekte olmamalı ama
        // migration bozuk bir satıra denk gelirse süreç asılı kalmamalı.
        const cyclic: CategoryNode[] = [
            { id: 100, slug: 'a', parent_id: 101 },
            { id: 101, slug: 'b', parent_id: 100 },
        ];
        expect(subtreeIds(cyclic, 100).sort((a, b) => a - b)).toEqual([100, 101]);
    });
});

describe('countryProductTotals', () => {
    it('alt ağaçtaki ürünleri ülke başına toplar', () => {
        const counts: CategoryProductCount[] = [
            { categoryId: 90, countryId: PL, n: 30 },
            { categoryId: 2, countryId: TR, n: 12 },
            { categoryId: 2, countryId: PL, n: 5 },
        ];
        expect(countryProductTotals(NODES, counts, 89)).toEqual(
            new Map([
                [PL, 35],
                [TR, 12],
            ]),
        );
    });

    it('ürünsüz alt ağaç için boş harita döner', () => {
        expect(countryProductTotals(NODES, [], 20).size).toBe(0);
    });
});

describe('resolveOwners', () => {
    const counts: CategoryProductCount[] = [
        { categoryId: 90, countryId: PL, n: 30 },
        { categoryId: 2, countryId: TR, n: 12 },
        { categoryId: 2, countryId: PL, n: 5 },
    ];

    it('tek ülkeye ait kategoriyi o ülkeye verir', () => {
        expect(resolveOwners(NODES, counts).get(90)).toEqual([PL]);
    });

    it('iki ülkenin ürünü olan kategoriyi ikisine birden verir — çağıran böler', () => {
        expect(resolveOwners(NODES, counts).get(2)?.slice().sort()).toEqual([TR, PL].sort());
    });

    it('alt ağacındaki ülkeleri devralır', () => {
        // 89'un kendi ürünü yok ama çocukları TR+PL taşıyor.
        expect(resolveOwners(NODES, counts).get(89)?.slice().sort()).toEqual([TR, PL].sort());
    });

    it('ürünü olmayan kategoriye hiç ülke vermez — silinecek demektir', () => {
        expect(resolveOwners(NODES, counts).get(20)).toEqual([]);
        expect(resolveOwners(NODES, counts).get(1)).toEqual([]);
    });

    it('her kategori için bir kayıt döner', () => {
        const owners = resolveOwners(NODES, counts);
        expect(owners.size).toBe(NODES.length);
    });

    it('ülke listesi kararlı sırada gelir — plan çıktısı tekrarlanabilir olsun', () => {
        expect(resolveOwners(NODES, counts).get(2)).toEqual([TR, PL]);
    });
});
