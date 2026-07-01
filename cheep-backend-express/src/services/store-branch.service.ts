import { prisma } from '../utils/prisma.client.js';

export interface BranchLite {
  id: number; store_id: number; name: string; lat: number; lon: number; address: string | null; city: string | null;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearestBranchPerStore(branches: BranchLite[], user: { lat: number; lon: number }) {
  const best = new Map<number, { store_id: number; branch: BranchLite; distanceKm: number }>();
  for (const b of branches) {
    const d = haversineKm(user, b);
    const cur = best.get(b.store_id);
    if (!cur || d < cur.distanceKm) best.set(b.store_id, { store_id: b.store_id, branch: b, distanceKm: d });
  }
  return Array.from(best.values()).sort((x, y) => x.distanceKm - y.distanceKm);
}

export function resolveNearestBranchCoords(branches: BranchLite[], user: { lat: number; lon: number }): Map<number, { lat: number; lon: number }> {
  const out = new Map<number, { lat: number; lon: number }>();
  for (const { store_id, branch } of nearestBranchPerStore(branches, user)) {
    out.set(store_id, { lat: branch.lat, lon: branch.lon });
  }
  return out;
}

/** DB: fetch country's branches near the user (bbox prefilter), then nearest-per-store. */
export async function getNearbyStores(countryId: number, user: { lat: number; lon: number }, deltaDeg = 1.0) {
  const rows = await prisma.storeBranch.findMany({
    where: {
      country_id: countryId,
      lat: { gte: user.lat - deltaDeg, lte: user.lat + deltaDeg },
      lon: { gte: user.lon - deltaDeg, lte: user.lon + deltaDeg },
    },
    select: { id: true, store_id: true, name: true, lat: true, lon: true, address: true, city: true },
  });
  return nearestBranchPerStore(rows as BranchLite[], user);
}

/** DB: nearest branch coords per given store within a country (for compare distance). */
export async function nearestBranchCoordsForStores(storeIds: number[], countryId: number, user: { lat: number; lon: number }) {
  const rows = await prisma.storeBranch.findMany({
    where: { country_id: countryId, store_id: { in: storeIds } },
    select: { id: true, store_id: true, name: true, lat: true, lon: true, address: true, city: true },
  });
  return resolveNearestBranchCoords(rows as BranchLite[], user);
}
