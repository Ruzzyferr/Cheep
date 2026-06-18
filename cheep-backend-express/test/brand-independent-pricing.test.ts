import { describe, it, expect } from 'vitest';
import { resolveItemStoreOptions, PricedProduct } from '../src/services/brand-independent-pricing';

const store = (id: number, name: string): any => ({ id, name, lat: null, lon: null });

const A: PricedProduct = {
  id: 1, name: 'A Süt 1L', brand: 'A', image_url: null,
  store_prices: [{ store_id: 10, price: 30, store: store(10, 'Migros') }],
};
const B: PricedProduct = {
  id: 2, name: 'B Süt 1L', brand: 'B', image_url: null,
  store_prices: [{ store_id: 11, price: 25, store: store(11, 'A101') }],
};

describe('resolveItemStoreOptions', () => {
  it('brand-independent=false: sadece representative ürünü kullanır', () => {
    const opts = resolveItemStoreOptions(A, false, [B]);
    expect(opts.size).toBe(1);
    expect(opts.get(10)!.product.id).toBe(1);
    expect(opts.get(10)!.price).toBe(30);
    expect(opts.has(11)).toBe(false); // B markete bakılmaz
  });

  it('brand-independent=true: her markette en ucuz markayı seçer', () => {
    const opts = resolveItemStoreOptions(A, true, [B]);
    expect(opts.get(10)!.product.id).toBe(1); // Migros: sadece A var
    expect(opts.get(11)!.product.id).toBe(2); // A101: B var
    expect(opts.get(11)!.price).toBe(25);
  });

  it('aynı markette daha ucuz sibling representative\'i geçer', () => {
    const cheaperB: PricedProduct = {
      id: 2, name: 'B Süt 1L', brand: 'B', image_url: null,
      store_prices: [{ store_id: 10, price: 22, store: store(10, 'Migros') }],
    };
    const opts = resolveItemStoreOptions(A, true, [cheaperB]);
    expect(opts.get(10)!.product.id).toBe(2); // Migros'ta B daha ucuz
    expect(opts.get(10)!.price).toBe(22);
  });

  it('siblings boşsa (tekil ürün) brand-independent davranışı = marka sabit', () => {
    const opts = resolveItemStoreOptions(A, true, []);
    expect(opts.size).toBe(1);
    expect(opts.get(10)!.product.id).toBe(1);
  });
});
