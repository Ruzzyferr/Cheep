import { describe, it, expect } from 'vitest';
import { upsertStorePriceSchema } from '../src/api/store-prices/store-price.schema.js';

describe('PL ingest schema', () => {
  it('accepts szt and opak units', () => {
    for (const unit of ['szt', 'opak']) {
      const { error } = upsertStorePriceSchema.validate({
        store_id: 44, store_sku: 'x1', price: '4.99', unit, name: 'Mleko 1L',
      });
      expect(error).toBeUndefined();
    }
  });

  it('still rejects unknown units', () => {
    const { error } = upsertStorePriceSchema.validate({
      store_id: 44, store_sku: 'x1', price: '4.99', unit: 'stück', name: 'Mleko 1L',
    });
    expect(error).toBeDefined();
  });
});
