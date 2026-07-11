import { describe, it, expect, vi, beforeEach } from 'vitest';

// harvest-ean imports prisma + productMatcher; mock both so the pure index/plan
// logic and the merge orchestration can be exercised without a DB.
const prismaMock = {
  product: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  country: { findUnique: vi.fn() },
};
const mergeMock = vi.fn(async () => ({ success: true }));
vi.mock('../src/utils/prisma.client.js', () => ({ prisma: prismaMock }));
vi.mock('../src/api/products/product-matcher.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/products/product-matcher.service.js')>();
  return { ...actual, productMatcher: { mergeProducts: mergeMock } };
});

const { buildEanIndex, planAssignments, computeKey, applyAssignments } = await import(
  '../scripts/harvest-ean.js'
);

// Convenience product factory.
function prod(over: Partial<any>): any {
  return { id: 0, name: '', brand: null, ean_barcode: null, store_prices: [], ...over };
}

describe('harvest-ean: computeKey guards', () => {
  it('returns null when brand missing AND requireBrand (borrower side)', () => {
    expect(computeKey(prod({ name: 'Mleko UHT 3,2% 1L', brand: null }), { requireBrand: true })).toBeNull();
    expect(computeKey(prod({ name: 'Mleko UHT 3,2% 1L', brand: '   ' }), { requireBrand: true })).toBeNull();
  });
  it('allows a null brand column on the SOURCE side (brand lives in the name)', () => {
    // Wolt EAN products carry the brand in the name with a null column.
    const k = computeKey(prod({ name: 'Piątnica Jogurt naturalny 330 g', brand: null }));
    expect(k).not.toBeNull();
  });
  it('source (brand-in-name, null column) and borrower (brand column) yield the SAME key', () => {
    const src = computeKey(prod({ name: 'Piątnica Jogurt naturalny 330 g', brand: null }));
    const borrower = computeKey(prod({ name: 'Jogurt naturalny 330 g', brand: 'Piątnica' }), { requireBrand: true });
    expect(src!.key).toBe(borrower!.key);
  });
  it('returns null when size (gramaj) missing', () => {
    expect(computeKey(prod({ name: 'Mleko UHT', brand: 'Łaciate' }))).toBeNull();
  });
  it('returns null when name too generic (<2 meaningful tokens)', () => {
    expect(computeKey(prod({ name: 'Mleko 1L', brand: 'Łaciate' }))).toBeNull();
  });
  it('returns a stable key for a well-formed product', () => {
    const k = computeKey(prod({ name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate' }));
    expect(k).not.toBeNull();
    expect(typeof k!.key).toBe('string');
    expect(k!.gramaj).toBe('1000ml');
  });
});

describe('harvest-ean: buildEanIndex', () => {
  it('dedups identical (brand,name,size) sharing one EAN and indexes it', () => {
    const idx = buildEanIndex([
      prod({ id: 1, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000001' }),
      prod({ id: 2, name: 'Łaciate Mleko UHT 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000001' }),
    ]);
    const k = computeKey(prod({ name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate' }))!;
    expect(idx.eanByKey.get(k.key)).toBe('5900000000001');
    expect(idx.ambiguous.has(k.key)).toBe(false);
  });

  it('flags a key AMBIGUOUS when 2+ different EANs collide on it', () => {
    const idx = buildEanIndex([
      prod({ id: 1, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000001' }),
      prod({ id: 2, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000999' }),
    ]);
    const k = computeKey(prod({ name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate' }))!;
    expect(idx.ambiguous.has(k.key)).toBe(true);
    expect(idx.eanByKey.has(k.key)).toBe(false);
  });

  it('excludes mf- synthetic barcodes from the index source', () => {
    const idx = buildEanIndex([
      prod({ id: 1, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: 'mf-abc123' }),
    ]);
    expect(idx.eanByKey.size).toBe(0);
  });
});

describe('harvest-ean: planAssignments', () => {
  const source = prod({ id: 1, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000001' });
  const index = buildEanIndex([source]);

  it('assigns the EAN to a same brand+name+size no-EAN product', () => {
    const target = prod({ id: 2, name: 'Łaciate Mleko UHT 3,2% 1L', brand: 'Łaciate' });
    const { assignments } = planAssignments([target], index);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].ean).toBe('5900000000001');
    expect(assignments[0].product.id).toBe(2);
  });

  it('assigns from a null-brand source (brand in name) to a brand-column borrower', () => {
    const src = prod({ id: 10, name: 'Piątnica Jogurt naturalny 330 g', brand: null, ean_barcode: '5900000000330' });
    const idx = buildEanIndex([src]);
    const borrower = prod({ id: 11, name: 'Jogurt naturalny 330 g', brand: 'Piątnica' });
    const { assignments } = planAssignments([borrower], idx);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].ean).toBe('5900000000330');
  });

  it('does NOT assign to a borrower with no brand column (requireBrand)', () => {
    const src = prod({ id: 12, name: 'Piątnica Jogurt naturalny 330 g', brand: null, ean_barcode: '5900000000330' });
    const idx = buildEanIndex([src]);
    // Borrower without a brand column: even if the name matched, we refuse.
    const borrower = prod({ id: 13, name: 'Jogurt naturalny 330 g', brand: null });
    const { assignments } = planAssignments([borrower], idx);
    expect(assignments).toHaveLength(0);
  });

  it('does NOT assign across a different size', () => {
    const target = prod({ id: 3, name: 'Mleko UHT Łaciate 3,2% 500ml', brand: 'Łaciate' });
    const { assignments } = planAssignments([target], index);
    expect(assignments).toHaveLength(0);
  });

  it('does NOT assign across a different brand', () => {
    const target = prod({ id: 4, name: 'Mleko UHT Mlekovita 3,2% 1L', brand: 'Mlekovita' });
    const { assignments } = planAssignments([target], index);
    expect(assignments).toHaveLength(0);
  });

  it('assigns nothing for an ambiguous key and counts the skip', () => {
    const ambIndex = buildEanIndex([
      prod({ id: 1, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000001' }),
      prod({ id: 5, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000999' }),
    ]);
    const target = prod({ id: 6, name: 'Łaciate Mleko UHT 3,2% 1L', brand: 'Łaciate' });
    const { assignments, ambiguousSkips } = planAssignments([target], ambIndex);
    expect(assignments).toHaveLength(0);
    expect(ambiguousSkips).toBe(1);
  });
});

describe('harvest-ean: applyAssignments merge path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invokes mergeProducts when the borrowed EAN already exists on another product', async () => {
    const owner = prod({ id: 1, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000001', store_prices: [{ store_id: 40 }, { store_id: 47 }] });
    const noEan = prod({ id: 2, name: 'Łaciate Mleko UHT 3,2% 1L', brand: 'Łaciate', store_prices: [{ store_id: 41 }] });
    const ownerByEan = new Map<string, any>([['5900000000001', owner]]);

    const stats = await applyAssignments(
      [{ product: noEan, ean: '5900000000001', key: 'k' }],
      ownerByEan,
      { dryRun: false },
    );

    // owner has 2 prices, noEan 1 → owner is target, noEan merged into it.
    expect(mergeMock).toHaveBeenCalledWith(2, 1);
    expect(stats.merged).toBe(1);
    // owner already carries the EAN → no ean_barcode update needed.
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  it('when the no-EAN product has more prices it becomes target and gets the EAN set', async () => {
    const owner = prod({ id: 1, name: 'Mleko UHT Łaciate 3,2% 1L', brand: 'Łaciate', ean_barcode: '5900000000001', store_prices: [{ store_id: 40 }] });
    const noEan = prod({ id: 2, name: 'Łaciate Mleko UHT 3,2% 1L', brand: 'Łaciate', store_prices: [{ store_id: 41 }, { store_id: 44 }] });
    const ownerByEan = new Map<string, any>([['5900000000001', owner]]);

    await applyAssignments(
      [{ product: noEan, ean: '5900000000001', key: 'k' }],
      ownerByEan,
      { dryRun: false },
    );

    // noEan has more prices → owner merged into noEan, then noEan gets the EAN.
    expect(mergeMock).toHaveBeenCalledWith(1, 2);
    expect(prismaMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 2 }, data: { ean_barcode: '5900000000001' } }),
    );
  });

  it('dry-run performs no writes', async () => {
    const owner = prod({ id: 1, ean_barcode: '5900000000001', store_prices: [{ store_id: 40 }] });
    const noEan = prod({ id: 2, store_prices: [{ store_id: 41 }] });
    const ownerByEan = new Map<string, any>([['5900000000001', owner]]);
    await applyAssignments([{ product: noEan, ean: '5900000000001', key: 'k' }], ownerByEan, { dryRun: true });
    expect(mergeMock).not.toHaveBeenCalled();
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });
});
