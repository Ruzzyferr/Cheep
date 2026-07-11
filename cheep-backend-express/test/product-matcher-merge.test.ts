import { describe, it, expect, vi, beforeEach } from 'vitest';

// mergeProducts runs its own $transaction: move storePrices+listItems, delete
// source, optionally set the target's ean_barcode. Mock the tx client so we
// can assert call ORDER (delete must happen before the EAN is set on target,
// otherwise two rows would momentarily share @@unique([country_id, ean_barcode])).
const storePriceUpdateMany = vi.fn();
const listItemUpdateMany = vi.fn();
const productDelete = vi.fn();
const productUpdate = vi.fn();
const callOrder: string[] = [];

const txClient = {
  storePrice: { updateMany: (...a: any[]) => { callOrder.push('storePrice.updateMany'); return storePriceUpdateMany(...a); } },
  listItem: { updateMany: (...a: any[]) => { callOrder.push('listItem.updateMany'); return listItemUpdateMany(...a); } },
  product: {
    delete: (...a: any[]) => { callOrder.push('product.delete'); return productDelete(...a); },
    update: (...a: any[]) => { callOrder.push('product.update'); return productUpdate(...a); },
  },
};

const $transaction = vi.fn(async (fn: any) => fn(txClient));

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    $transaction: (...a: any[]) => $transaction(...a),
  },
}));

const { productMatcher } = await import('../src/api/products/product-matcher.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
});

describe('mergeProducts', () => {
  it('without setTargetEan: no ean update, behaves exactly as before', async () => {
    await productMatcher.mergeProducts(1, 2);

    expect(storePriceUpdateMany).toHaveBeenCalledWith({
      where: { product_id: 1 },
      data: { product_id: 2 },
    });
    expect(listItemUpdateMany).toHaveBeenCalledWith({
      where: { product_id: 1 },
      data: { product_id: 2 },
    });
    expect(productDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it('with setTargetEan: sets ean_barcode on target within the SAME transaction, AFTER the source delete', async () => {
    await productMatcher.mergeProducts(1, 2, '5900000000001');

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(productDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { ean_barcode: '5900000000001' },
    });

    // Ordering guard: delete-then-set avoids a transient unique(country_id,
    // ean_barcode) collision between source and target.
    const deleteIdx = callOrder.indexOf('product.delete');
    const updateIdx = callOrder.indexOf('product.update');
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(updateIdx).toBeGreaterThan(deleteIdx);
  });

  it('returns { success: true } in both cases', async () => {
    await expect(productMatcher.mergeProducts(1, 2)).resolves.toEqual({ success: true });
    await expect(productMatcher.mergeProducts(3, 4, '123')).resolves.toEqual({ success: true });
  });
});
