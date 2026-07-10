import { describe, it, expect } from 'vitest';
import { generateProductFingerprint } from '../src/api/products/product-matcher.service.js';

describe('Polish diacritics in fingerprint', () => {
  it('folds diacritics so both chain spellings match', () => {
    const a = generateProductFingerprint({ name: 'Mleko Łaciate świeże 2% 1L', brand: 'Łaciate' });
    const b = generateProductFingerprint({ name: 'Mleko Laciate swieze 2% 1l', brand: 'Laciate' });
    expect(a).toBe(b);
    expect(a).toContain('laciate');
  });

  it('keeps different sizes apart (gramaj in fingerprint)', () => {
    const a = generateProductFingerprint({ name: 'Mleko Łaciate 2% 1L' });
    const b = generateProductFingerprint({ name: 'Mleko Łaciate 2% 0,5L' });
    expect(a).not.toBe(b);
  });

  it('folds ż/ź/ó/ą/ę/ć/ń/ś', () => {
    const a = generateProductFingerprint({ name: 'Żółty ser dojrzewający Śnieżka' });
    const b = generateProductFingerprint({ name: 'Zolty ser dojrzewajacy Sniezka' });
    expect(a).toBe(b);
  });
});
