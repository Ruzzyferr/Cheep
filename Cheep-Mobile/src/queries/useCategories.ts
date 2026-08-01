/**
 * 📂 Kategori sorguları.
 *
 * Sıralama ve seçim TAMAMEN API'den gelir. Eskiden `categoryIcon.ts` içinde
 * elle yazılmış bir `HOME_PRIORITY` listesi vardı ve anasayfa ilk 7'yi ona
 * göre seçiyordu; listenin ilk sırası ürünü olmayan ölü bir kategoriye denk
 * geldiği için kullanıcı tıklayınca boş ekran görüyordu. Artık backend zaten
 * ürünü olmayan kategoriyi hiç döndürmüyor ve sırayı `display_order` veriyor.
 */
import { useQuery } from '@tanstack/react-query';
import { categoryService, type Category } from '../services/category.service';
import { qk } from './keys';
import { useScope } from './scope';
import { STALE } from './client';

export function useParentCategories() {
    const scope = useScope();
    return useQuery({
        queryKey: qk.categories.parents(scope),
        queryFn: () => categoryService.getParentCategories(),
        staleTime: STALE.static,
    });
}

/**
 * Alt kategoriler.
 *
 * `parentId === 0` "Tüm Kategoriler" sanal seçimidir, gerçek bir kategori
 * değil. Backend'e sorulursa 400 döner; sorguyu hiç açmıyoruz.
 */
export function useSubcategories(parentId: number | null | undefined) {
    const scope = useScope();
    const enabled = typeof parentId === 'number' && parentId > 0;
    return useQuery({
        queryKey: qk.categories.subcategories(scope, parentId ?? 0),
        queryFn: () => categoryService.getSubcategories(parentId as number),
        enabled,
        staleTime: STALE.static,
    });
}

export type { Category };
