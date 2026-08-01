/**
 * 📋 Liste sorguları ve mutasyonları.
 *
 * BURASI "GERİ DÖNÜNCE ESKİ VERİ" SORUNUNUN ÇÖZÜLDÜĞÜ YER.
 *
 * Eskiden liste değiştiren her ekran kendi state'ini güncelliyor, diğer
 * ekranlar haberi olmadan bayat kalıyordu: kullanıcı ürün ekleyip anasayfaya
 * dönünce eski sayıyı görüyor ve elle yenilemek zorunda kalıyordu.
 *
 * Artık her mutasyon başarıda `['lists', country]` önekini geçersizleştiriyor.
 * O önek altındaki HER ŞEY — liste listesi, liste detayı, aktif liste,
 * karşılaştırma sonucu — kendiliğinden tazeleniyor. Yeni bir ekran eklendiğinde
 * ayrıca bir şey yapmak gerekmiyor; sorgusunu bu önekle açması yeter.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listService } from '../services';
import { qk } from './keys';
import { useScope } from './scope';
import { STALE } from './client';
import type { AddListItemRequest, CompareRequest, ShoppingList } from '../types';

export function useLists(status?: 'active' | 'completed' | 'all') {
    const scope = useScope();
    return useQuery({
        queryKey: qk.lists.byStatus(scope, status),
        queryFn: () => listService.getLists(status),
        staleTime: STALE.live,
    });
}

/** Aktif liste — sepet rozeti ve "hangi listeye ekliyorum" pill'i bunu okur. */
export function useActiveList() {
    const scope = useScope();
    return useQuery({
        queryKey: qk.lists.active(scope),
        queryFn: async (): Promise<ShoppingList | null> => {
            const lists = await listService.getLists();
            return lists.find((l) => l.status === 'active') ?? null;
        },
        staleTime: STALE.live,
    });
}

export function useListDetail(id: number | undefined) {
    const scope = useScope();
    return useQuery({
        queryKey: qk.lists.detail(scope, id ?? 0),
        queryFn: () => listService.getListById(id as number),
        enabled: typeof id === 'number' && id > 0,
        staleTime: STALE.live,
    });
}

export function useCompareList(id: number | undefined, opts: CompareRequest) {
    const scope = useScope();
    return useQuery({
        queryKey: qk.lists.compare(scope, id ?? 0, opts as Record<string, unknown>),
        queryFn: () => listService.compareList(id as number, opts),
        enabled: typeof id === 'number' && id > 0,
        staleTime: STALE.live,
    });
}

/**
 * Liste mutasyonları.
 *
 * Hepsi aynı geçersizleştirmeyi yapar: `['lists', country]` öneki. Ayrı ayrı
 * key saymak (detay, aktif, karşılaştırma…) unutulan bir key bırakır ve tam
 * da düzeltmeye çalıştığımız bayatlık geri gelir.
 */
export function useListMutations() {
    const scope = useScope();
    const qc = useQueryClient();

    const invalidateLists = () => qc.invalidateQueries({ queryKey: qk.lists.all(scope) });

    const addItem = useMutation({
        mutationFn: ({ listId, data }: { listId: number; data: AddListItemRequest }) =>
            listService.addItem(listId, data),
        onSuccess: invalidateLists,
    });

    const createList = useMutation({
        mutationFn: (name: string) => listService.createList({ name }),
        onSuccess: invalidateLists,
    });

    const deleteItem = useMutation({
        mutationFn: ({ listId, itemId }: { listId: number; itemId: number }) =>
            listService.deleteItem(listId, itemId),
        onSuccess: invalidateLists,
    });

    const updateItem = useMutation({
        mutationFn: ({
            itemId,
            data,
        }: {
            itemId: number;
            data: { quantity?: number; unit?: string; brand_independent?: boolean };
        }) => listService.updateItem(itemId, data),
        onSuccess: invalidateLists,
    });

    const deleteList = useMutation({
        mutationFn: (id: number) => listService.deleteList(id),
        onSuccess: invalidateLists,
    });

    const activateList = useMutation({
        mutationFn: (id: number) => listService.activate(id),
        onSuccess: invalidateLists,
    });

    return { addItem, createList, deleteItem, updateItem, deleteList, activateList, invalidateLists };
}
