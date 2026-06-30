/**
 * 🛒 Cart (active list) context
 *
 * Tracks the user's active shopping list summary — item count + name — so the UI
 * can show a cart badge on the Lists tab and a "which list am I adding to" pill
 * while browsing, WITHOUT opening the Lists screen. Any screen that mutates a list
 * calls refresh() to keep the badge accurate.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { listService } from '../services';
import type { ShoppingList } from '../types';

interface CartContextType {
  activeList: ShoppingList | null;
  count: number;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);

  const refresh = useCallback(async () => {
    try {
      const lists = await listService.getLists('active');
      // İlk şablon-olmayan aktif liste = kullanıcının üzerinde çalıştığı liste.
      const active = lists.find((l) => !l.is_template) ?? lists[0] ?? null;
      setActiveList(active);
    } catch {
      // sessizce geç — rozet kritik değil
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const count = activeList?.list_items?.length ?? 0;

  return (
    <CartContext.Provider value={{ activeList, count, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  // Sağlayıcı dışında çağrılırsa (örn. test) güvenli no-op döndür.
  if (!ctx) {
    return { activeList: null, count: 0, refresh: async () => {} };
  }
  return ctx;
}
