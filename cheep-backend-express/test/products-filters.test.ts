import { describe, it, expect } from 'vitest';
import { getProductsQuerySchema } from '../src/api/products/product.schema.js';
import {
    buildProductFilter,
    SORT_MODES,
    type ProductFilterInput,
} from '../src/api/products/product-filter.js';

/**
 * Website'nin ürünler sayfası kategori ağacı, market çipleri, sıralama ve
 * fiyat aralığıyla çalışıyor. Bunların hepsi tek uçtan gelmeli — istemcide
 * filtreleme yapmak 15.619 ürünü tarayıcıya indirmek demekti.
 */

const parse = (q: Record<string, unknown>) => getProductsQuerySchema.validate(q, { convert: true });

describe('getProductsQuerySchema', () => {
    it('kategori slug\'ını kabul eder — website URL\'leri slug tabanlı', () => {
        expect(parse({ category_slug: 'meyve-sebze' }).error).toBeUndefined();
    });

    it('çoklu market slug\'ını virgülle kabul eder', () => {
        const { error, value } = parse({ store_slug: 'bim,a101,migros' });
        expect(error).toBeUndefined();
        expect(value.store_slug).toEqual(['bim', 'a101', 'migros']);
    });

    it('tek market slug\'ını da diziye çevirir — çağıran tek tip görsün', () => {
        expect(parse({ store_slug: 'bim' }).value.store_slug).toEqual(['bim']);
    });

    it('bilinen sıralama modlarını kabul eder', () => {
        for (const mode of SORT_MODES) {
            expect(parse({ sort: mode }).error, mode).toBeUndefined();
        }
    });

    it('bilinmeyen sıralamayı reddeder — sessizce varsayılana düşmez', () => {
        expect(parse({ sort: 'rastgele' }).error).toBeDefined();
    });

    it('fiyat aralığını sayıya çevirir', () => {
        const { value } = parse({ min_price: '10.5', max_price: '99' });
        expect(value.min_price).toBe(10.5);
        expect(value.max_price).toBe(99);
    });

    it('negatif fiyatı reddeder', () => {
        expect(parse({ min_price: '-1' }).error).toBeDefined();
    });

    it('min_stores için alt sınır uygular', () => {
        expect(parse({ min_stores: '0' }).error).toBeDefined();
        expect(parse({ min_stores: '2' }).error).toBeUndefined();
    });

    it('limit üst sınırını korur — tek istekte tüm katalog çekilemesin', () => {
        expect(parse({ limit: '5000' }).error).toBeDefined();
    });
});

describe('buildProductFilter', () => {
    const base: ProductFilterInput = { countryId: 1 };

    it('ülkeyi her zaman uygular', () => {
        expect(buildProductFilter(base).countryId).toBe(1);
    });

    it('kategori slug\'ı verilmişse id filtresi kurulmaz — çözüm çağırana ait', () => {
        const f = buildProductFilter({ ...base, category_slug: 'meyve-sebze' });
        expect(f.categorySlug).toBe('meyve-sebze');
        expect(f.categoryId).toBeUndefined();
    });

    it('varsayılan sıralama alakadır', () => {
        expect(buildProductFilter(base).sort).toBe('relevance');
    });

    it('arama yokken alaka sıralaması market sayısına düşer', () => {
        // "relevance" arama terimi olmadan anlamsız; en çok markette bulunan
        // ürün listenin başına gelmeli (karşılaştırma değeri en yüksek olan).
        expect(buildProductFilter({ ...base, sort: 'relevance' }).effectiveSort).toBe('store_count');
    });

    it('arama varken alaka sıralaması korunur', () => {
        expect(buildProductFilter({ ...base, search: 'süt', sort: 'relevance' }).effectiveSort).toBe(
            'relevance',
        );
    });

    it('açık sıralama isteği aramadan bağımsız korunur', () => {
        expect(buildProductFilter({ ...base, sort: 'price_asc' }).effectiveSort).toBe('price_asc');
    });

    it('fiyat aralığı ters verilmişse düzeltir — boş sonuç yerine anlamlı sonuç', () => {
        const f = buildProductFilter({ ...base, min_price: 100, max_price: 10 });
        expect(f.minPrice).toBe(10);
        expect(f.maxPrice).toBe(100);
    });

    it('boş market listesini yok sayar — hiçbir markete filtrelemek her şeyi siler', () => {
        expect(buildProductFilter({ ...base, store_slug: [] }).storeSlugs).toBeUndefined();
    });

    it('market slug\'larını tekilleştirir', () => {
        expect(buildProductFilter({ ...base, store_slug: ['bim', 'bim', 'a101'] }).storeSlugs).toEqual([
            'bim',
            'a101',
        ]);
    });
});
