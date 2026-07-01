import type { ChainAlias } from '../config/store-brand-aliases.js';

export interface BranchInput {
  store_id: number; name: string; lat: number; lon: number;
  address?: string; city?: string; external_ref: string; source: 'osm';
}

const DIACRITICS: Record<string, string> = {
  'ı':'i','İ':'i','ş':'s','Ş':'s','ğ':'g','Ğ':'g','ç':'c','Ç':'c','ö':'o','Ö':'o','ü':'u','Ü':'u',
  'å':'a','ä':'a','é':'e','ł':'l','ń':'n','ś':'s','ż':'z','ź':'z','ą':'a','ę':'e','ó':'o','à':'a','â':'a','ê':'e',
};
export function normalizeName(s: string): string {
  return (s || '').split('').map(c => DIACRITICS[c] ?? c).join('').toLowerCase().trim().replace(/\s+/g, ' ');
}

function tokens(s: string): string[] {
  return normalizeName(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** true if aliasTokens appear as a contiguous run inside nameTokens */
function phraseInTokens(aliasTokens: string[], nameTokens: string[]): boolean {
  if (aliasTokens.length === 0 || aliasTokens.length > nameTokens.length) return false;
  for (let i = 0; i + aliasTokens.length <= nameTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < aliasTokens.length; j++) {
      if (nameTokens[i + j] !== aliasTokens[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

export function matchChain(tags: Record<string, string>, aliases: ChainAlias[]): { store_id: number; chain: string } | null {
  const brandNorm = normalizeName(tags.brand || '');
  const brandTokens = tokens(tags.brand || '');
  const nameTokens = tokens(tags.name || '');
  for (const a of aliases) {
    for (const alias of a.aliases) {
      const al = normalizeName(alias);
      const alTokens = tokens(alias);
      if (brandNorm === al) return { store_id: a.store_id, chain: a.chain };
      if (phraseInTokens(alTokens, brandTokens)) return { store_id: a.store_id, chain: a.chain };
      if (phraseInTokens(alTokens, nameTokens)) return { store_id: a.store_id, chain: a.chain };
    }
  }
  return null;
}

export function parseOverpassElements(json: any, aliases: ChainAlias[]): BranchInput[] {
  const out: BranchInput[] = [];
  for (const el of json?.elements ?? []) {
    const tags = el.tags || {};
    const m = matchChain(tags, aliases);
    if (!m) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || undefined;
    out.push({
      store_id: m.store_id,
      name: tags.name || m.chain,
      lat, lon,
      address,
      city: tags['addr:city'] || undefined,
      external_ref: `osm:${el.type}/${el.id}`,
      source: 'osm',
    });
  }
  return out;
}

export function buildOverpassQuery(areaName: string, aliases: ChainAlias[]): string {
  // Match any of the chains' brand/name within the named area.
  const names = aliases.flatMap(a => a.aliases).map(s => s.replace(/"/g, ''));
  const regex = names.join('|');
  return `[out:json][timeout:180];
area["name"="${areaName}"]["admin_level"="2"]->.a;
( node["shop"~"supermarket|convenience|grocery"]["name"~"${regex}",i](area.a);
  way["shop"~"supermarket|convenience|grocery"]["name"~"${regex}",i](area.a);
  node["shop"~"supermarket|convenience|grocery"]["brand"~"${regex}",i](area.a);
  way["shop"~"supermarket|convenience|grocery"]["brand"~"${regex}",i](area.a);
);
out center tags;`;
}
