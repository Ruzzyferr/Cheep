import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRaw = vi.fn();
const findFirst = vi.fn();
vi.mock('../src/utils/prisma.client.js', () => ({
    prisma: {
        $queryRaw: (...a: any[]) => queryRaw(...a),
        category: { findFirst: (...a: any[]) => findFirst(...a) },
    },
}));

import {
    buildTree,
    onlyParents,
    childrenOf,
    getParentCategories,
    getSubcategories,
    type CategoryRow,
} from '../src/api/categories/categories.service.js';

/**
 * Kategori listeleri artık ÜLKEYE göre süzülür ve ürünü olmayan kategori hiç
 * dönmez. Kök neden: taksonomi uzun süre ülkesizdi, TR ve PL ağaçları tek
 * tabloda çakıştı; anasayfa bu yüzden "Meyve ve Sebze" gibi 0 ürünlü ölü bir
 * kabuğu gösteriyordu.
 */

const ROWS: CategoryRow[] = [
    { id: 100, name: 'Meyve & Sebze', slug: 'meyve-sebze', parent_id: null, display_order: 2, icon_url: '🍎', product_count: 180 },
    { id: 21, name: 'Sebze', slug: 'sebze', parent_id: 100, display_order: 2, icon_url: null, product_count: 120 },
    { id: 22, name: 'Meyve', slug: 'meyve', parent_id: 100, display_order: 1, icon_url: null, product_count: 60 },
    { id: 23, name: 'Temel Gıda', slug: 'temel-gida', parent_id: null, display_order: 4, icon_url: '🌾', product_count: 700 },
];

beforeEach(() => {
    queryRaw.mockReset();
    findFirst.mockReset();
});

describe('buildTree', () => {
    it('çocukları parent altına yerleştirir', () => {
        const tree = buildTree(ROWS);
        expect(tree.map((t) => t.id)).toEqual([100, 23]);
        expect(tree[0].children.map((c) => c.id)).toEqual([22, 21]);
    });

    it('çocukları display_order ile sıralar', () => {
        const tree = buildTree(ROWS);
        expect(tree[0].children.map((c) => c.slug)).toEqual(['meyve', 'sebze']);
    });

    it('parent listesini display_order ile sıralar', () => {
        expect(buildTree(ROWS).map((t) => t.slug)).toEqual(['meyve-sebze', 'temel-gida']);
    });

    it('öksüz satırı (parent listede yok) kök sayar — sessizce yutmaz', () => {
        const orphan: CategoryRow[] = [
            { id: 7, name: 'Öksüz', slug: 'oksuz', parent_id: 999, display_order: 1, icon_url: null, product_count: 3 },
        ];
        expect(buildTree(orphan).map((t) => t.id)).toEqual([7]);
    });
});

describe('onlyParents / childrenOf', () => {
    it('onlyParents yalnızca kökleri döner', () => {
        expect(onlyParents(ROWS).map((r) => r.id)).toEqual([100, 23]);
    });

    it('childrenOf verilen parent\'ın çocuklarını sıralı döner', () => {
        expect(childrenOf(ROWS, 100).map((r) => r.slug)).toEqual(['meyve', 'sebze']);
    });

    it('childrenOf çocuğu olmayan için boş döner', () => {
        expect(childrenOf(ROWS, 23)).toEqual([]);
    });
});

describe('getParentCategories', () => {
    it('sorguya countryId geçirir', async () => {
        queryRaw.mockResolvedValueOnce([]);
        await getParentCategories(2);
        // Prisma tagged template: ilk argüman strings dizisi, sonrası değerler.
        const values = queryRaw.mock.calls[0].slice(1);
        expect(values).toContain(2);
    });

    it('yalnızca kök kategorileri döner', async () => {
        queryRaw.mockResolvedValueOnce(ROWS.map((r) => ({ ...r, product_count: BigInt(r.product_count) })));
        const out = await getParentCategories(1);
        expect(out.map((c) => c.slug)).toEqual(['meyve-sebze', 'temel-gida']);
    });

    it('product_count değerini BigInt\'ten Number\'a çevirir — JSON serileştirme patlamasın', async () => {
        queryRaw.mockResolvedValueOnce([{ ...ROWS[0], product_count: BigInt(180) }]);
        const out = await getParentCategories(1);
        expect(out[0].product_count).toBe(180);
        expect(typeof out[0].product_count).toBe('number');
    });
});

describe('getSubcategories', () => {
    it('yalnızca verilen parent\'ın çocuklarını döner', async () => {
        queryRaw.mockResolvedValueOnce(ROWS.map((r) => ({ ...r, product_count: BigInt(r.product_count) })));
        const out = await getSubcategories(100, 1);
        expect(out.map((c) => c.slug)).toEqual(['meyve', 'sebze']);
    });
});
