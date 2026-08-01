/**
 * 🔑 Query key fabrikası.
 *
 * NEDEN MERKEZÎ: geçersizleştirme (invalidation) key eşleşmesine dayanır.
 * Key'ler çağrı yerlerine dağılmış olsaydı, listeye ürün ekleyen ekran
 * anasayfanın key'ini bilemez ve tazeleyemezdi — uygulamanın "geri dönünce
 * eski veriyi gösterme" sorunu tam olarak buydu.
 *
 * ÜLKE VE DİL HER KEY'İN PARÇASI: aynı istek TR/PL'de farklı katalog, tr/en'de
 * farklı kategori adları döndürür. Bunlar key'de olmasa ülke değiştiren
 * kullanıcı bir önceki ülkenin cache'ini görürdü.
 */

export interface Scope {
    country: string;
    lang: string;
}

export const qk = {
    /** Tüm kategori sorguları — `qk.categories.all(scope)` ile toplu invalidate. */
    categories: {
        all: (s: Scope) => ['categories', s.country, s.lang] as const,
        parents: (s: Scope) => ['categories', s.country, s.lang, 'parents'] as const,
        subcategories: (s: Scope, parentId: number) =>
            ['categories', s.country, s.lang, 'sub', parentId] as const,
        tree: (s: Scope) => ['categories', s.country, s.lang, 'tree'] as const,
    },

    products: {
        all: (s: Scope) => ['products', s.country, s.lang] as const,
        list: (s: Scope, params: Record<string, unknown>) =>
            ['products', s.country, s.lang, 'list', stableParams(params)] as const,
        detail: (s: Scope, id: number) => ['products', s.country, s.lang, 'detail', id] as const,
        history: (s: Scope, id: number, days: number) =>
            ['products', s.country, s.lang, 'history', id, days] as const,
        search: (s: Scope, term: string) => ['products', s.country, s.lang, 'search', term] as const,
    },

    lists: {
        all: (s: Scope) => ['lists', s.country] as const,
        byStatus: (s: Scope, status?: string) => ['lists', s.country, 'status', status ?? 'any'] as const,
        detail: (s: Scope, id: number) => ['lists', s.country, 'detail', id] as const,
        /** Aktif liste — sepet rozeti bunu dinler. */
        active: (s: Scope) => ['lists', s.country, 'active'] as const,
        compare: (s: Scope, id: number, opts: Record<string, unknown>) =>
            ['lists', s.country, 'compare', id, stableParams(opts)] as const,
    },

    stores: {
        all: (s: Scope) => ['stores', s.country] as const,
        detail: (s: Scope, id: number) => ['stores', s.country, 'detail', id] as const,
    },

    deals: {
        all: (s: Scope) => ['deals', s.country, s.lang] as const,
    },

    notifications: {
        all: () => ['notifications'] as const,
        unreadCount: () => ['notifications', 'unreadCount'] as const,
    },

    profile: {
        me: () => ['profile'] as const,
    },
} as const;

/**
 * Parametre nesnesini sıradan bağımsız, kararlı bir anahtara çevirir.
 *
 * `{a:1, b:2}` ile `{b:2, a:1}` AYNI sorgudur; nesneyi olduğu gibi key'e
 * koymak React Query'nin yapısal karşılaştırmasında çoğu durumda çalışır ama
 * `undefined` alanlar ve alan sırası farklı cache girdileri üretebiliyor.
 * Burada `undefined` alanlar atılır ve alanlar sıralanır.
 */
export function stableParams(params: Record<string, unknown>): string {
    const entries = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
}
