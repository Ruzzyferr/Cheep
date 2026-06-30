/**
 * 🧮 Compare insights
 *
 * Route prices are only comparable when they cover the SAME items. A single-store
 * route that's missing 4 products can be "cheaper" than a complete basket — but
 * that's apples-to-oranges and confused users ("En ucuz 352 ama en iyi rota 504").
 *
 * These helpers pick the set of *comparable* routes (prefer fully-covering routes;
 * otherwise the highest-coverage tier) and derive cheapest / savings from THAT set,
 * so "En Ucuz" and "Tasarruf" always reflect a like-for-like basket.
 */
import type { RouteStrategy } from '../types';

export function missingCount(s: RouteStrategy): number {
  return s.missingProducts?.length ?? 0;
}

export function isComplete(s: RouteStrategy): boolean {
  return missingCount(s) === 0;
}

/** Routes whose prices can be fairly compared: all complete ones, else the
 *  highest-coverage tier. */
export function comparableStrategies(strategies: RouteStrategy[]): RouteStrategy[] {
  if (!strategies.length) return [];
  const complete = strategies.filter(isComplete);
  if (complete.length) return complete;
  const maxCov = Math.max(...strategies.map((s) => s.coveragePercentage ?? 0));
  return strategies.filter((s) => (s.coveragePercentage ?? 0) === maxCov);
}

export interface CompareInsights {
  cheapest: RouteStrategy | null;
  min: number;
  max: number;
  savings: number;
  savingsPct: number;
  allComplete: boolean; // the comparable set fully covers the list
  comparableCount: number;
}

export function compareInsights(strategies: RouteStrategy[]): CompareInsights {
  const comp = comparableStrategies(strategies).filter((s) => s.totalPrice > 0);
  if (!comp.length) {
    return { cheapest: null, min: 0, max: 0, savings: 0, savingsPct: 0, allComplete: false, comparableCount: 0 };
  }
  const cheapest = comp.reduce((a, b) => (b.totalPrice < a.totalPrice ? b : a), comp[0]);
  const prices = comp.map((s) => s.totalPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const savings = prices.length > 1 ? Math.round((max - min) * 100) / 100 : 0;
  const savingsPct = max > 0 ? Math.round((savings / max) * 100) : 0;
  return {
    cheapest,
    min,
    max,
    savings,
    savingsPct,
    allComplete: isComplete(comp[0]),
    comparableCount: comp.length,
  };
}

/** Default route ranking for "best": most complete basket first, then best score.
 *  A complete basket should be recommended over a cheaper-but-incomplete one. */
export function byCoverageThenScore(a: RouteStrategy, b: RouteStrategy): number {
  const ca = a.coveragePercentage ?? 0;
  const cb = b.coveragePercentage ?? 0;
  if (cb !== ca) return cb - ca;
  return (b.score ?? 0) - (a.score ?? 0);
}
