import { describe, it, expect } from 'vitest';
import { generateProductFingerprint } from '../src/api/products/product-matcher.service';

describe('generateProductFingerprint (STRICT gramaj korunur)', () => {
  it('farklı gramajlı aynı ürün ASLA aynı fingerprint üretmez (1L != 2L)', () => {
    const a = generateProductFingerprint({ name: 'Süt 1L', brand: 'Pınar' });
    const b = generateProductFingerprint({ name: 'Süt 2L', brand: 'Pınar' });
    expect(a).not.toBe(b);
  });

  it('500ml != 1L', () => {
    const a = generateProductFingerprint({ name: 'Süt 500ml', brand: 'Pınar' });
    const b = generateProductFingerprint({ name: 'Süt 1L', brand: 'Pınar' });
    expect(a).not.toBe(b);
  });

  it('aynı isim + aynı gramaj → aynı fingerprint (regression: birleşmeli)', () => {
    const a = generateProductFingerprint({ name: 'Pınar Süt 1 L', brand: 'Pınar' });
    const b = generateProductFingerprint({ name: 'Pınar Süt 1L', brand: 'Pınar' });
    expect(a).toBe(b);
  });

  it('gramaj token fingerprint içinde görünür', () => {
    const fp = generateProductFingerprint({ name: 'Süt 1L', brand: 'Pınar' });
    expect(fp).toContain('@1000ml');
  });
});
