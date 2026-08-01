/**
 * 🛒 Sepet (aktif liste) bağlamı.
 *
 * Kullanıcının aktif listesinin özetini — ad + ürün sayısı — verir; Listeler
 * sekmesindeki rozet ve "hangi listeye ekliyorum" pill'i bunu okur.
 *
 * ARTIK KENDİ STATE'İNİ TUTMUYOR: veriyi `useActiveList` sorgusundan alıyor.
 * Eskiden her mutasyon yapan ekranın elle `refresh()` çağırması gerekiyordu ve
 * biri unutulduğunda rozet bayat kalıyordu. Şimdi liste mutasyonları
 * `['lists']` önekini geçersizleştirdiği için rozet kendiliğinden güncelleniyor.
 *
 * Bağlam yine de duruyor: çağrı yerleri değişmesin ve gelecekte sepete özgü
 * bir davranış eklenirse tek yerde toplansın.
 */
import React, { createContext, useContext, ReactNode } from 'react';
import { useActiveList } from '../queries/useLists';
import type { ShoppingList } from '../types';

interface CartContextType {
  activeList: ShoppingList | null;
  count: number;
  /** Elle tazeleme — normalde gerekmez, mutasyonlar zaten geçersizleştirir. */
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { data, refetch } = useActiveList();
  const activeList = data ?? null;

  const value: CartContextType = {
    activeList,
    count: activeList?.list_items?.length ?? 0,
    refresh: async () => {
      await refetch();
    },
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  // Sağlayıcı dışında çağrılırsa (örn. test) güvenli no-op döndür.
  if (!ctx) {
    return { activeList: null, count: 0, refresh: async () => {} };
  }
  return ctx;
}
