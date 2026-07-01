import { describe, it, expect } from 'vitest';
import { applyBranchCoords } from '../src/services/compare-engine.service.js';

it('applyBranchCoords overrides store coords with nearest-branch coords when available', () => {
  const stores = [
    { id: 1, name: 'Migros', lat: 38.41, lon: 27.12 },   // İzmir placeholder
    { id: 9, name: 'NoBranch', lat: 40.0, lon: 30.0 },
  ];
  const branchCoords = new Map<number, {lat:number;lon:number}>([[1, { lat: 37.32, lon: 40.74 }]]);
  const out = applyBranchCoords(stores as any, branchCoords);
  expect(out.find(s => s.id === 1)!.lat).toBeCloseTo(37.32); // overridden to Mardin branch
  expect(out.find(s => s.id === 9)!.lat).toBeCloseTo(40.0);  // unchanged (no branch)
});
