/**
 * 🏪 Store Logo Utility
 * Market logolarını ülkeye göre assets klasöründen yükler.
 * Ülkeler arası fallback YOK — yanlış ülkenin logosu asla gösterilmez.
 */

const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

const LOGOS: Record<string, Record<string, any>> = {
  TR: {
    migros: require('../../assets/images/TurkiyeCompanies/M-Migros.png'),
    carrefour: require('../../assets/images/TurkiyeCompanies/carrefour.webp'),
    carrefoursa: require('../../assets/images/TurkiyeCompanies/carrefour.webp'),
  },
  CH: {}, SE: {}, DE: {}, PL: {}, // add requires as logo assets land
};

export function getStoreLogoAsset(country: string | null | undefined, storeName: string | null | undefined): any {
  if (!storeName) return null;
  const map = LOGOS[(country || '').toUpperCase()] ?? {};
  const n = normalize(storeName);
  if (map[n]) return map[n];
  for (const [key, asset] of Object.entries(map)) {
    if (n.includes(key) || key.includes(n)) return asset;
  }
  return null;
}

export function getStoreLogoSource(country: string | null | undefined, storeName: string | null | undefined): { source: any } | null {
  const asset = getStoreLogoAsset(country, storeName);
  return asset ? { source: asset } : null;
}
