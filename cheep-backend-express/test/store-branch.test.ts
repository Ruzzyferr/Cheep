import { describe, it, expect } from 'vitest';
import { haversineKm, nearestBranchPerStore, resolveNearestBranchCoords, type BranchLite } from '../src/services/store-branch.service.js';

const branches: BranchLite[] = [
  { id: 1, store_id: 1, name: 'Migros İzmir', lat: 38.4192, lon: 27.1287, address: null, city: 'İzmir' },
  { id: 2, store_id: 1, name: 'Migros Mardin', lat: 37.3212, lon: 40.7245, address: null, city: 'Mardin' },
  { id: 3, store_id: 4, name: 'ŞOK Mardin', lat: 37.3100, lon: 40.7300, address: null, city: 'Mardin' },
];
const mardin = { lat: 37.3212, lon: 40.7433 };

describe('store-branch geo', () => {
  it('haversineKm: İzmir→Mardin is ~1000+ km, same point ~0', () => {
    expect(haversineKm(branches[0], branches[1])).toBeGreaterThan(900);
    expect(haversineKm(mardin, mardin)).toBeLessThan(0.001);
  });

  it('nearestBranchPerStore picks the Mardin branch for a Mardin user (NOT İzmir)', () => {
    const res = nearestBranchPerStore(branches, mardin);
    const migros = res.find(r => r.store_id === 1)!;
    expect(migros.branch.city).toBe('Mardin');
    expect(migros.distanceKm).toBeLessThan(5);
    // sorted ascending by distance
    expect(res[0].distanceKm).toBeLessThanOrEqual(res[res.length - 1].distanceKm);
  });

  it('resolveNearestBranchCoords maps store_id to nearest coords', () => {
    const m = resolveNearestBranchCoords(branches, mardin);
    expect(m.get(1)!.lat).toBeCloseTo(37.3212);
  });
});
