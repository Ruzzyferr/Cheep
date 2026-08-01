import { describe, it, expect } from 'vitest';
import { qk, stableParams, type Scope } from '../keys';

/**
 * Key'ler geçersizleştirmenin (invalidation) tek dayanağı. Bir ekran listeye
 * ürün eklediğinde anasayfanın tazelenmesi, iki tarafın AYNI key önekini
 * üretmesine bağlı. Bu yüzden key şekli teste bağlanmıştır.
 */

const tr: Scope = { country: 'TR', lang: 'tr' };
const pl: Scope = { country: 'PL', lang: 'pl' };
const trEn: Scope = { country: 'TR', lang: 'en' };

describe('qk — kapsam ayrımı', () => {
    it('ülke farkı farklı key üretir — ülke değişince eski katalog görünmesin', () => {
        expect(qk.products.list(tr, { limit: 10 })).not.toEqual(qk.products.list(pl, { limit: 10 }));
    });

    it('dil farkı farklı key üretir — kategori adları dile bağlı', () => {
        expect(qk.categories.parents(tr)).not.toEqual(qk.categories.parents(trEn));
    });

    it('liste key\'leri ülkeye bağlı ama dile bağlı DEĞİL — liste içeriği çevrilmiyor', () => {
        expect(qk.lists.all(tr)).toEqual(qk.lists.all(trEn));
    });
});

describe('qk — invalidation önekleri', () => {
    const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
        prefix.every((p, i) => key[i] === p);

    it('kategori alt key\'leri `all` önekiyle başlar', () => {
        const prefix = qk.categories.all(tr);
        expect(startsWith(qk.categories.parents(tr), prefix)).toBe(true);
        expect(startsWith(qk.categories.subcategories(tr, 5), prefix)).toBe(true);
        expect(startsWith(qk.categories.tree(tr), prefix)).toBe(true);
    });

    it('ürün alt key\'leri `all` önekiyle başlar', () => {
        const prefix = qk.products.all(tr);
        expect(startsWith(qk.products.list(tr, {}), prefix)).toBe(true);
        expect(startsWith(qk.products.detail(tr, 3), prefix)).toBe(true);
        expect(startsWith(qk.products.search(tr, 'süt'), prefix)).toBe(true);
    });

    it('liste alt key\'leri `all` önekiyle başlar — tek invalidate hepsini tazeler', () => {
        const prefix = qk.lists.all(tr);
        expect(startsWith(qk.lists.detail(tr, 1), prefix)).toBe(true);
        expect(startsWith(qk.lists.active(tr), prefix)).toBe(true);
        expect(startsWith(qk.lists.compare(tr, 1, {}), prefix)).toBe(true);
        expect(startsWith(qk.lists.byStatus(tr, 'active'), prefix)).toBe(true);
    });
});

describe('stableParams', () => {
    it('alan sırasından bağımsızdır', () => {
        expect(stableParams({ a: 1, b: 2 })).toBe(stableParams({ b: 2, a: 1 }));
    });

    it('undefined ve boş alanları yok sayar — aynı sorgu iki cache girdisi olmasın', () => {
        expect(stableParams({ a: 1, b: undefined, c: '' })).toBe(stableParams({ a: 1 }));
    });

    it('gerçek fark farklı anahtar üretir', () => {
        expect(stableParams({ a: 1 })).not.toBe(stableParams({ a: 2 }));
    });

    it('0 ve false gerçek değerlerdir — atılmaz', () => {
        expect(stableParams({ a: 0 })).not.toBe(stableParams({}));
        expect(stableParams({ a: false })).not.toBe(stableParams({}));
    });
});
