import { describe, it, expect } from 'vitest';
import { normalizeSearchInput, tokenizeSearch, isBarcodeQuery } from '../src/api/products/product-search.util.js';

describe('normalizeSearchInput', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeSearchInput('  yağsız   süt ')).toBe('yağsız süt');
  });
  it('caps length at 80 chars', () => {
    expect(normalizeSearchInput('a'.repeat(200)).length).toBe(80);
  });
  it('empty stays empty', () => {
    expect(normalizeSearchInput('   ')).toBe('');
  });
});

describe('tokenizeSearch', () => {
  it('splits on whitespace and drops empties', () => {
    expect(tokenizeSearch('yağsız  süt')).toEqual(['yağsız', 'süt']);
  });
  it('caps at 6 tokens', () => {
    expect(tokenizeSearch('a b c d e f g h')).toHaveLength(6);
  });
  it('empty query → empty array', () => {
    expect(tokenizeSearch('')).toEqual([]);
  });
});

describe('isBarcodeQuery', () => {
  it('true for 6+ digit strings', () => {
    expect(isBarcodeQuery('8690504')).toBe(true);
  });
  it('false for short digits', () => {
    expect(isBarcodeQuery('123')).toBe(false);
  });
  it('false for text', () => {
    expect(isBarcodeQuery('süt')).toBe(false);
  });
});
