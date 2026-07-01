import { prisma } from '../src/utils/prisma.client.js';
import { getCountryByCode } from '../src/utils/country.js';
import { BRAND_ALIASES } from '../src/config/store-brand-aliases.js';
import { buildOverpassQuery, parseOverpassElements } from '../src/services/overpass.service.js';

const AREA: Record<string, string> = { TR: 'Türkiye', CH: 'Schweiz/Suisse/Svizzera/Svizra', SE: 'Sverige', DE: 'Deutschland', PL: 'Polska' };
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

async function importCountry(code: string) {
  const aliases = BRAND_ALIASES[code];
  if (!aliases) { console.log(`skip ${code}: no aliases`); return; }
  const country = await getCountryByCode(code);
  const query = buildOverpassQuery(AREA[code], aliases);
  console.log(`[${code}] querying Overpass…`);
  const res = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Cheep-Import/1.0 (+https://swiip.app)' } });
  if (!res.ok) { console.error(`[${code}] Overpass ${res.status}`); return; }
  const json = await res.json();
  const branches = parseOverpassElements(json, aliases);
  let upserted = 0;
  for (const b of branches) {
    await prisma.storeBranch.upsert({
      where: { external_ref: b.external_ref },
      update: { name: b.name, lat: b.lat, lon: b.lon, address: b.address ?? null, city: b.city ?? null },
      create: { store_id: b.store_id, country_id: country.id, name: b.name, lat: b.lat, lon: b.lon, address: b.address ?? null, city: b.city ?? null, source: 'osm', external_ref: b.external_ref },
    });
    upserted++;
  }
  const byChain = aliases.map(a => `${a.chain}:${branches.filter(b => b.store_id === a.store_id).length}`).join(', ');
  console.log(`[${code}] upserted ${upserted} branches (${byChain})`);
}

const arg = process.argv[2]?.toUpperCase();
const codes = arg ? [arg] : Object.keys(BRAND_ALIASES);
for (const c of codes) { await importCountry(c); }
await prisma.$disconnect();
