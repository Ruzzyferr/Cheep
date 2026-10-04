/**
 * Adet mantığının SAF kısmı — React'ten ve react-native'den bağımsız,
 * bu yüzden doğrudan test edilebiliyor.
 */
import type { ShoppingList } from '../types';

/** Backend `quantity` alanı Float (1.5 kg gibi). Tam sayıysa ondalık BASMA:
 *  "3" yazar, "3.0" değil. */
export function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Number(q.toFixed(2)));
}

export interface AdetKaydi {
  itemId: number;
  quantity: number;
}

/**
 * Listeyi `product_id -> { itemId, quantity }` haritasına çevirir.
 *
 * ALAN ADI `list_items`, `items` DEĞİL. İlk yazımda `items` okunuyordu; harita
 * sessizce boş kalıyor, her ürün adet 0 görünüyor ve adet denetimi hiç
 * çıkmıyordu. Testi bu yüzden var: alan adı değişirse burada patlasın.
 */
export function adetHaritasiKur(liste?: ShoppingList | null): Map<number, AdetKaydi> {
  const m = new Map<number, AdetKaydi>();
  for (const o of liste?.list_items ?? []) {
    if (o?.product_id == null) continue;
    m.set(o.product_id, { itemId: o.id, quantity: o.quantity });
  }
  return m;
}
