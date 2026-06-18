import { describe, it, expect } from 'vitest';
import { evaluateProductConstraints } from '../src/services/product-constraints';

describe('evaluateProductConstraints', () => {
  it('vegan profilde et kategorisini gizler', () => {
    const v = evaluateProductConstraints('Et & Tavuk', { diet: 'vegan' });
    expect(v.hidden).toBe(true);
  });
  it('vegan profilde sebzeyi gizlemez', () => {
    const v = evaluateProductConstraints('Meyve & Sebze', { diet: 'vegan' });
    expect(v.hidden).toBe(false);
  });
  it('pesketaryen balığı gizlemez ama tavuğu gizler', () => {
    expect(evaluateProductConstraints('Balık', { diet: 'pescatarian' }).hidden).toBe(false);
    expect(evaluateProductConstraints('Et & Tavuk', { diet: 'pescatarian' }).hidden).toBe(true);
  });
  it('pork_gelatin avoid: şarküteri için uyarı verir', () => {
    const v = evaluateProductConstraints('Şarküteri', { avoid: ['pork_gelatin'] });
    expect(v.warnings.length).toBeGreaterThan(0);
  });
  it('kategori null ise gizlemez, kısıt yoksa temiz döner', () => {
    const v = evaluateProductConstraints(null, {});
    expect(v.hidden).toBe(false);
    expect(v.warnings).toEqual([]);
  });
});
