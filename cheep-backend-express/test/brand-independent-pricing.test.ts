import { describe, it, expect } from 'vitest';
import { resolveItemStoreOptions, extractGramaj, PricedProduct } from '../src/services/brand-independent-pricing';

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

  // NEW: different gramaj sibling must NOT override representative
  it('brand-independent: farklı gramajlı sibling seçilmez (500ml != 1L)', () => {
    const rep: PricedProduct = {
      id: 1, name: 'Süt 1L', brand: 'A', image_url: null,
      store_prices: [{ store_id: 10, price: 30, store: store(10, 'Migros') }],
    };
    const wrongSize: PricedProduct = {
      id: 3, name: 'Süt 500ml', brand: 'B', image_url: null,
      // cheaper price but different size — must NOT be selected
      store_prices: [{ store_id: 10, price: 20, store: store(10, 'Migros') }],
    };
    const opts = resolveItemStoreOptions(rep, true, [wrongSize]);
    // store10 must still be the representative (1L @ 30), not the 500ml @ 20
    expect(opts.get(10)!.product.id).toBe(1);
    expect(opts.get(10)!.price).toBe(30);
  });

  // NEW: same gramaj sibling with different brand IS chosen when cheaper
  it('brand-independent: aynı gramajlı daha ucuz sibling seçilir (regression)', () => {
    const rep: PricedProduct = {
      id: 1, name: 'A Marka Süt 1L', brand: 'A', image_url: null,
      store_prices: [{ store_id: 10, price: 30, store: store(10, 'Migros') }],
    };
    const sameSize: PricedProduct = {
      id: 4, name: 'B Marka Süt 1L', brand: 'B', image_url: null,
      store_prices: [{ store_id: 10, price: 22, store: store(10, 'Migros') }],
    };
    const opts = resolveItemStoreOptions(rep, true, [sameSize]);
    expect(opts.get(10)!.product.id).toBe(4);
    expect(opts.get(10)!.price).toBe(22);
  });
});

describe('extractGramaj', () => {
  it("'Yarım Yağlı Süt 1 L' → '1000ml'", () => {
    expect(extractGramaj('Yarım Yağlı Süt 1 L')).toBe('1000ml');
  });

  it("'Süt 500 ml' → '500ml'", () => {
    expect(extractGramaj('Süt 500 ml')).toBe('500ml');
  });

  it("'Un 1 Kg' → '1000g'", () => {
    expect(extractGramaj('Un 1 Kg')).toBe('1000g');
  });

  it("'Bisküvi 350 g' → '350g'", () => {
    expect(extractGramaj('Bisküvi 350 g')).toBe('350g');
  });

  it("'1,5 L Su' → '1500ml'", () => {
    expect(extractGramaj('1,5 L Su')).toBe('1500ml');
  });

  it("'Yumurta 10 Adet' → '10adet'", () => {
    expect(extractGramaj('Yumurta 10 Adet')).toBe('10adet');
  });

  it("'Kaşar Peyniri' → null (no size token)", () => {
    expect(extractGramaj('Kaşar Peyniri')).toBeNull();
  });

  it("'Süt 500ml' (no space) → '500ml'", () => {
    expect(extractGramaj('Süt 500ml')).toBe('500ml');
  });

  it("'Zeytin Yağı 1 lt' → '1000ml'", () => {
    expect(extractGramaj('Zeytin Yağı 1 lt')).toBe('1000ml');
  });

  it("'Bisküvi 350gr' (no space) → '350g'", () => {
    expect(extractGramaj('Bisküvi 350gr')).toBe('350g');
  });

  it("'Su 1.5 L' (dot decimal) → '1500ml'", () => {
    expect(extractGramaj('Su 1.5 L')).toBe('1500ml');
  });

  it("'Deterjan 1 Cl' → '10ml'", () => {
    expect(extractGramaj('Deterjan 1 Cl')).toBe('10ml');
  });
});
