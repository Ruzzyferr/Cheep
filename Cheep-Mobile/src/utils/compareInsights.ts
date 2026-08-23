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



export type RouteSortOption = 'score' | 'price' | 'distance' | 'price_distance';

/**
 * Rota sıralaması — GÖRÜNENLE tutarlı.
 *
 * Eski hâlde kademeler ondalıklı `coveragePercentage`'a göre kuruluyordu, ama
 * ekran kapsamayı yuvarlayarak ("%100") ve ikili bir rozetle ("tüm ürünler
 * bu rotada") gösteriyor. İki rota da "%100" derken biri 100, diğeri 99.6 ise
 * sıralama görünmeyen bir farka göre kuruluyordu: kullanıcı önerilen rotada
 * "Skor 52", hemen altındaki alternatifte "Skor 56" görüp uygulamayı bozuk
 * sanıyordu.
 *
 * Artık kademe, ekranın gösterdiği ayrımın aynısı: sepet TAM mı, değil mi.
 * Tam sepetler arasında kullanıcının gördüğü ölçüt (skor/fiyat/mesafe) tek
 * belirleyici. Eksik sepetler arasında kapsama hâlâ önemli — orada zaten
 * "N ürün eksik" yazıyor, yani fark görünür.
 */
export function rankStrategies<T extends RouteStrategy>(
  strategies: T[],
  sortOption: RouteSortOption
): T[] {
  return [...strategies].sort((a, b) => {
    const ca = isComplete(a);
    const cb = isComplete(b);
    if (ca !== cb) return ca ? -1 : 1;

    // Eksik sepetler arasında daha fazlasını kapsayan öne geçer.
    if (!ca) {
      const cov = (b.coveragePercentage ?? 0) - (a.coveragePercentage ?? 0);
      if (cov !== 0) return cov;
    }

    switch (sortOption) {
      case 'price':
        return a.totalPrice - b.totalPrice;
      case 'distance':
        return a.totalDistance - b.totalDistance;
      case 'price_distance': {
        const priceDiff = a.totalPrice - b.totalPrice;
        if (Math.abs(priceDiff) < 10) return a.totalDistance - b.totalDistance;
        return priceDiff;
      }
      case 'score':
      default:
        return (b.score ?? 0) - (a.score ?? 0);
    }
  });
}
