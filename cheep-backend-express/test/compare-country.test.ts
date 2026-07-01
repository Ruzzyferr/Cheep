import { describe, it, expect } from 'vitest';
import { filterStorePricesByCountry } from '../src/services/compare-engine.service.js';

const listItems = [{
  id: 1, product_id: 10, quantity: 1, unit: 'adet', brand_independent: false,
  product: {
    id: 10, name: 'Süt', brand: null, image_url: null, category_id: null, muadil_grup_id: null,
    store_prices: [
      { id: 1, store_id: 1, price: 40, unit: 'adet', store: { id: 1, name: 'Migros', country_id: 1, lat: null, lon: null } },
      { id: 2, store_id: 30, price: 2, unit: 'adet', store: { id: 30, name: 'REWE', country_id: 3, lat: null, lon: null } },
    ],
  },
}];

describe('filterStorePricesByCountry', () => {
  it('keeps only prices whose store.country_id matches', () => {
    const out = filterStorePricesByCountry(listItems as any, 1);
    expect(out[0].product.store_prices).toHaveLength(1);
    expect(out[0].product.store_prices[0].store.name).toBe('Migros');
  });

  it('is a no-op when countryId is undefined', () => {
    const out = filterStorePricesByCountry(listItems as any, undefined);
    expect(out[0].product.store_prices).toHaveLength(2);
  });
});
