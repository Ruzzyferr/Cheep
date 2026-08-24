/**
 * 🛍️ Ürün sorguları.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { productService } from '../services';
import { qk } from './keys';
import { useScope } from './scope';
import { STALE } from './client';
import type { Product } from '../types';

export interface ProductListParams extends Record<string, unknown> {
    search?: string;
    category_id?: number;
    limit?: number;
}

/**
 * Sonsuz kaydırmalı ürün listesi.
 *
 * Sayfalama `offset` üzerinden: backend `pagination.hasMore` döndürüyor ve
 * son sayfada `undefined` vererek döngüyü kapatıyoruz. Eskiden bu mantık
 * `CategoryProductsScreen` içinde elle yazılmıştı — iki eşzamanlı isteğin
 * yarıştığı, eski yanıtın yenisini ezdiği bir istek-kimliği guard'ıyla
 * birlikte. React Query bu yarışı kendi çözüyor.
 */
export function useProductsInfinite(params: ProductListParams) {
    const scope = useScope();
    const limit = params.limit ?? 24;

    return useInfiniteQuery({
        queryKey: qk.products.list(scope, { ...params, limit }),
        initialPageParam: 0,
        queryFn: ({ pageParam }) =>
            productService.getProductsPage({
                ...params,
                limit,
                offset: pageParam as number,
            }),
        getNextPageParam: (lastPage, allPages) =>
            lastPage.hasMore ? allPages.reduce((n, p) => n + p.items.length, 0) : undefined,
        staleTime: STALE.catalog,
    });
}

/** Sayfaları düz bir ürün dizisine indirger ve tekilleştirir. */
export function flattenProducts(
    pages: { items: Product[] }[] | undefined,
): Product[] {
    if (!pages) return [];
    const seen = new Set<number>();
    const out: Product[] = [];
    for (const page of pages) {
        for (const p of page.items) {
            // Sayfa sınırında aynı ürün iki kez gelebilir (arada yeni ürün
            // eklenirse offset kayar); listede çift göstermeyiz.
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            out.push(p);
        }
    }
    return out;
}

export function useProduct(id: number | undefined) {
    const scope = useScope();
    return useQuery({
        queryKey: qk.products.detail(scope, id ?? 0),
        queryFn: () => productService.getProductById(id as number),
        enabled: typeof id === 'number' && id > 0,
        staleTime: STALE.catalog,
    });
}

/** Anasayfa vitrini ve fırsatlar için tek seferlik geniş çekim. */
export function useProductsList(params: ProductListParams & { limit: number }) {
    const scope = useScope();
    return useQuery({
        queryKey: qk.products.list(scope, params),
        queryFn: () => productService.getProducts(params),
        staleTime: STALE.catalog,
    });
}
