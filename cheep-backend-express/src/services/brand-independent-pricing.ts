export interface StoreRef { id: number; name: string; lat: number | null; lon: number | null }
export interface ProductRef { id: number; name: string; brand: string | null; image_url: string | null }
export interface RawStorePrice { store_id: number; price: number; store: StoreRef }
export interface PricedProduct extends ProductRef { store_prices: RawStorePrice[] }
export interface StoreOption { store_id: number; store: StoreRef; price: number; product: ProductRef }

function productRef(p: ProductRef): ProductRef {
  return { id: p.id, name: p.name, brand: p.brand, image_url: p.image_url };
}

function applyProduct(map: Map<number, StoreOption>, p: PricedProduct): void {
  for (const sp of p.store_prices) {
    const existing = map.get(sp.store_id);
    if (!existing || sp.price < existing.price) {
      map.set(sp.store_id, {
        store_id: sp.store_id,
        store: sp.store,
        price: sp.price,
        product: productRef(p),
      });
    }
  }
}

export function resolveItemStoreOptions(
  representative: PricedProduct,
  brandIndependent: boolean,
  siblings: PricedProduct[]
): Map<number, StoreOption> {
  const map = new Map<number, StoreOption>();
  applyProduct(map, representative);
  if (brandIndependent) {
    for (const sib of siblings) applyProduct(map, sib);
  }
  return map;
}
