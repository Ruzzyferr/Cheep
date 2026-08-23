import { describe, it, expect } from 'vitest';
import { rankStrategies } from '../compareInsights';
import type { RouteStrategy } from '../../types';

const s = (over: Partial<RouteStrategy>): RouteStrategy =>
  ({
    stores: [],
    totalPrice: 100,
    totalDistance: 0,
    score: 50,
    coveragePercentage: 100,
    missingProducts: [],
    ...over,
  } as unknown as RouteStrategy);

describe('rankStrategies', () => {
  it('tam sepetler eksik sepetlerin ÖNÜNDE gelir', () => {
    const eksik = s({ score: 99, missingProducts: [{ name: 'süt' }] as any, coveragePercentage: 80 });
    const tam = s({ score: 10 });
    expect(rankStrategies([eksik, tam], 'score')[0]).toBe(tam);
  });

  it('tam sepetler arasında GÖRÜNEN skor sıralamayı belirler', () => {
    // Hata buradaydı: ikisi de "%100 / tüm ürünler var" gösteriyordu ama
    // sıralama ondalıklı coveragePercentage'a bakıyordu. Kullanıcı önerilen
    // rotada 52, altındaki alternatifte 56 görüp uygulamayı bozuk sanıyordu.
    const dusuk = s({ score: 52, coveragePercentage: 100 });
    const yuksek = s({ score: 56, coveragePercentage: 99.6 });
    const sirali = rankStrategies([dusuk, yuksek], 'score');
    expect(sirali[0].score).toBe(56);
  });

  it('eksik sepetler arasında kapsama yüksek olan öne geçer', () => {
    const az = s({ score: 90, missingProducts: [{ name: 'a' }, { name: 'b' }] as any, coveragePercentage: 60 });
    const cok = s({ score: 10, missingProducts: [{ name: 'a' }] as any, coveragePercentage: 80 });
    expect(rankStrategies([az, cok], 'score')[0]).toBe(cok);
  });

  it('fiyat sıralamasında ucuz olan öne geçer (tam sepetler arasında)', () => {
    const pahali = s({ totalPrice: 200, score: 99 });
    const ucuz = s({ totalPrice: 100, score: 1 });
    expect(rankStrategies([pahali, ucuz], 'price')[0]).toBe(ucuz);
  });

  it('mesafe sıralamasında yakın olan öne geçer', () => {
    const uzak = s({ totalDistance: 20, score: 99 });
    const yakin = s({ totalDistance: 2, score: 1 });
    expect(rankStrategies([uzak, yakin], 'distance')[0]).toBe(yakin);
  });

  it('fiyat farkı önemsizse mesafe belirler', () => {
    const yakinPahali = s({ totalPrice: 105, totalDistance: 1 });
    const uzakUcuz = s({ totalPrice: 100, totalDistance: 30 });
    expect(rankStrategies([uzakUcuz, yakinPahali], 'price_distance')[0]).toBe(yakinPahali);
  });

  it('girdi dizisini DEĞİŞTİRMEZ', () => {
    const a = s({ score: 10 });
    const b = s({ score: 90 });
    const input = [a, b];
    rankStrategies(input, 'score');
    expect(input[0]).toBe(a);
  });
});
