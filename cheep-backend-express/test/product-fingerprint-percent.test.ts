import { describe, it, expect } from 'vitest';
import { generateProductFingerprint } from '../src/api/products/product-matcher.service.js';

describe('generateProductFingerprint (percentage/fat-content token)', () => {
  it('Auchan milk 3,2% vs 1.5% get DIFFERENT fingerprints (Poland pilot regression)', () => {
    const a = generateProductFingerprint({ name: 'Mleko UHT 3,2% Auchan 1l', brand: 'Auchan' });
    const b = generateProductFingerprint({ name: 'Mleko UHT 1.5% Auchan 1 l', brand: 'Auchan' });
    expect(a).not.toBe(b);
  });

  it('same percentage written with comma vs dot decimal → SAME fingerprint', () => {
    const a = generateProductFingerprint({ name: 'Mleko UHT 3,2% 1L' });
    const b = generateProductFingerprint({ name: 'Mleko UHT 3.2% 1l' });
    expect(a).toBe(b);
  });

  it('Turkish "%N" (percent before number) also distinguishes fat-content variants', () => {
    const a = generateProductFingerprint({ name: 'İçim Süt %3,5 1L' });
    const b = generateProductFingerprint({ name: 'İçim Süt %1,5 1L' });
    expect(a).not.toBe(b);
  });

  it('no-percent product fingerprint is byte-identical to the pre-fix value', () => {
    const fp = generateProductFingerprint({ name: 'Coca-Cola 1L', brand: 'Coca-Cola' });
    expect(fp).toBe('coca-cola@1000ml');
  });
});
