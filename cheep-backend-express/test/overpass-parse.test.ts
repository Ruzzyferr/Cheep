import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseOverpassElements, matchChain, normalizeName } from '../src/services/overpass.service.js';
import { BRAND_ALIASES } from '../src/config/store-brand-aliases.js';

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/overpass-tr-sample.json', import.meta.url)), 'utf8'));

describe('overpass parse/match', () => {
  it('normalizeName strips diacritics + lowercases', () => {
    expect(normalizeName('ŞOK Market')).toBe('sok market');
    expect(normalizeName('Migros M')).toBe('migros m');
  });

  it('matchChain matches by brand or name alias, diacritic-insensitive', () => {
    expect(matchChain({ brand: 'Migros' }, BRAND_ALIASES.TR)?.store_id).toBe(1);
    expect(matchChain({ name: 'ŞOK Market Konak' }, BRAND_ALIASES.TR)?.store_id).toBe(4);
    expect(matchChain({ name: 'Random Fırın' }, BRAND_ALIASES.TR)).toBeNull();
  });

  it('parseOverpassElements yields branches for matches only, using node coords or way center', () => {
    const out = parseOverpassElements(fixture, BRAND_ALIASES.TR);
    expect(out).toHaveLength(2);
    const migros = out.find(b => b.store_id === 1)!;
    expect(migros.external_ref).toBe('osm:node/111');
    expect(migros.city).toBe('Mardin');
    expect(migros.lat).toBeCloseTo(37.3212);
    const sok = out.find(b => b.store_id === 4)!;
    expect(sok.external_ref).toBe('osm:way/222');
    expect(sok.lat).toBeCloseTo(38.4190);
  });
});
