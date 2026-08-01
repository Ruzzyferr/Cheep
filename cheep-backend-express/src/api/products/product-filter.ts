/**
 * Ürün listeleme filtresinin saf kısmı.
 *
 * Website'nin ürünler sayfası kategori ağacı, market çipleri, sıralama ve
 * fiyat aralığıyla çalışıyor. Bunların hepsi tek uçtan gelmeli — istemcide
 * filtrelemek 15.619 ürünü tarayıcıya indirmek demekti.
 *
 * Girdi normalizasyonu (ters fiyat aralığı, tekrarlı market, anlamsız
 * sıralama) burada yapılır ki SQL üreten kod tek bir tutarlı şekil görsün ve
 * bu kurallar veritabanı olmadan test edilebilsin.
 */

/** Desteklenen sıralama modları. Bilinmeyen değer şemada reddedilir. */
export const SORT_MODES = ['relevance', 'price_asc', 'price_desc', 'savings', 'name'] as const;
export type SortMode = (typeof SORT_MODES)[number];

/** Sorguya çevrilen gerçek sıralama; `relevance` arama yoksa buna düşer. */
export type EffectiveSort = SortMode | 'store_count';

export interface ProductFilterInput {
    countryId: number;
    category_id?: number;
    category_slug?: string;
    store_slug?: string[];
    brand?: string;
    search?: string;
    sort?: SortMode;
    min_stores?: number;
    min_price?: number;
    max_price?: number;
}

export interface ProductFilter {
    countryId: number;
    categoryId?: number;
    categorySlug?: string;
    storeSlugs?: string[];
    brand?: string;
    search?: string;
    sort: SortMode;
    effectiveSort: EffectiveSort;
    minStores?: number;
    minPrice?: number;
    maxPrice?: number;
}

export function buildProductFilter(input: ProductFilterInput): ProductFilter {
    const sort: SortMode = input.sort ?? 'relevance';
    const hasSearch = Boolean(input.search && input.search.trim().length > 0);

    // "Alaka" arama terimi olmadan anlamsız. O durumda en çok markette bulunan
    // ürünü öne almak doğru varsayılan: karşılaştırma değeri en yüksek olan o.
    const effectiveSort: EffectiveSort = sort === 'relevance' && !hasSearch ? 'store_count' : sort;

    // Ters verilmiş aralık boş sonuç üretirdi; kullanıcı hatası yüzünden
    // "ürün yok" göstermek yerine düzeltiyoruz.
    let minPrice = input.min_price;
    let maxPrice = input.max_price;
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        [minPrice, maxPrice] = [maxPrice, minPrice];
    }

    // Boş dizi "hiçbir market" demek olurdu ve her şeyi silerdi; filtresiz say.
    const storeSlugs =
        input.store_slug && input.store_slug.length > 0
            ? [...new Set(input.store_slug)]
            : undefined;

    return {
        countryId: input.countryId,
        // Slug verilmişse id'ye dokunmayız: çözümü (slug → id) çağıran yapar,
        // çünkü ülke bağlamı ve alt ağaç genişletmesi orada.
        categoryId: input.category_slug ? undefined : input.category_id,
        categorySlug: input.category_slug,
        storeSlugs,
        brand: input.brand,
        search: input.search,
        sort,
        effectiveSort,
        minStores: input.min_stores,
        minPrice,
        maxPrice,
    };
}
