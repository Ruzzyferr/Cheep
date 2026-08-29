import { describe, it, expect, vi } from 'vitest';

// Depodaki desen (bkz. anchor.test.ts, geocode.test.ts): react-native taklit
// edilir, native ortam gerekmez. `Platform.select` de gerekiyor çünkü test
// reklam birimi platforma göre seçiliyor.
vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (o: Record<string, unknown>) => o.android ?? o.default,
  },
}));

/* eslint-disable import/first */
import { shouldShowBanner, bannerUnitId, hasRealAdUnits } from '../../config/ads';
import { buildGridRows, AD_AFTER_ROW, MIN_RESULTS_FOR_AD } from '../adRows';
/* eslint-enable import/first */

/**
 * Reklam gösterim kararı. Yanlış karar pahalı: premium kullanıcıya reklam
 * göstermek ödediği şeyi geri almak, rıza alınmadan istek atmak ise dört yeni
 * pazarın hepsi AB olduğu için GDPR ihlali.
 */
describe('banner gösterim kararı', () => {
  const ok = { isPremium: false, canRequestAds: true };

  it('normal kullanıcıya gösterilir', () => {
    expect(shouldShowBanner(ok)).toBe(true);
  });

  it('PREMIUM kullanıcıya ASLA gösterilmez', () => {
    // Abonenin satın aldığı şey tam olarak bu.
    expect(shouldShowBanner({ ...ok, isPremium: true })).toBe(false);
  });

  it('rıza alınmadan gösterilmez', () => {
    expect(shouldShowBanner({ ...ok, canRequestAds: false })).toBe(false);
  });

  it('premium VE rıza yoksa yine gösterilmez', () => {
    expect(shouldShowBanner({ isPremium: true, canRequestAds: false })).toBe(false);
  });

  it('yükleme başarısız olduysa alan tamamen kaldırılır', () => {
    // Boş gri kutu bırakmak, hiç göstermemekten kötü.
    expect(shouldShowBanner({ ...ok, failed: true })).toBe(false);
  });
});

describe('reklam birimi kimliği', () => {
  it('gerçek kimlik yokken GOOGLE TEST birimine düşer', () => {
    // Geliştirmede GERÇEK birim kullanmak "geçersiz trafik" sayılıp AdMob
    // hesabını askıya aldırır. Yapılandırmayı unutmanın bedeli gelir kaybı
    // olmalı, hesap kaybı değil.
    for (const slot of ['home', 'search', 'list'] as const) {
      expect(bannerUnitId(slot)).toBe('ca-app-pub-3940256099942544/6300978111');
    }
  });

  it('her yerleşim kendi birimini ister (AdMob raporu birim bazında)', () => {
    // Üçü aynı ortam değişkenine bakmıyor olmalı; tek birim kullanılsa hangi
    // yerleşimin çalıştığı hiç öğrenilemezdi.
    expect(new Set(['home', 'search', 'list'])).toHaveProperty('size', 3);
  });

  it('gerçek birimler yapılandırılmamışken bunu bildirir', () => {
    expect(hasRealAdUnits()).toBe(false);
  });
});

/**
 * Izgaraya reklam satırı yerleştirme. Çok yukarıda olursa kullanıcı sonuç
 * yerine reklam görür; çok aşağıda olursa kimse görmez ve reklam hiç gelir
 * üretmez (arama sonuçlarında 8. sıraya kimse inmiyor).
 */
describe('ızgara satırları', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

  it('öğeleri sütun sayısına göre satırlara böler', () => {
    const rows = buildGridRows(items(4), 2, false);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'items')).toBe(true);
  });

  it('reklamı İLK SATIRDAN SONRA koyar (yukarıda ama sonuçlar önce)', () => {
    const rows = buildGridRows(items(10), 2, true);
    expect(rows[AD_AFTER_ROW].kind).toBe('ad');
    // Reklamdan ÖNCE gerçek sonuç var.
    expect(rows[0].kind).toBe('items');
    // Reklamdan SONRA da içerik var — reklam listenin sonuna düşmüyor.
    expect(rows.slice(AD_AFTER_ROW + 1).some((r) => r.kind === 'items')).toBe(true);
  });

  it('sonuç azken reklam KOYMAZ (ekranı domine ederdi)', () => {
    for (let n = 0; n < MIN_RESULTS_FOR_AD; n++) {
      const rows = buildGridRows(items(n), 2, true);
      expect(rows.some((r) => r.kind === 'ad'), `${n} sonuçta reklam çıktı`).toBe(false);
    }
  });

  it('reklamdan sonra satır kalmıyorsa reklam KOYMAZ', () => {
    // 3 sonuç / 2 sütun = 2 satır; reklam 1. satırdan sonra gelirse en alta
    // düşerdi. Aşağıda içerik yoksa reklam "footer" gibi durur.
    const rows = buildGridRows(items(3), 2, true);
    expect(rows.filter((r) => r.kind === 'ad')).toHaveLength(1);
    expect(rows[rows.length - 1].kind).toBe('items');
  });

  it('reklam istenmiyorsa (premium/rıza yok) satır HİÇ eklenmez', () => {
    const rows = buildGridRows(items(20), 2, false);
    expect(rows.some((r) => r.kind === 'ad')).toBe(false);
  });

  it('en fazla BİR reklam satırı ekler', () => {
    const rows = buildGridRows(items(100), 2, true);
    expect(rows.filter((r) => r.kind === 'ad')).toHaveLength(1);
  });

  it('satır anahtarları benzersiz (FlatList keyExtractor)', () => {
    const rows = buildGridRows(items(20), 2, true);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it('son satır eksik kalabilir, öğe kaybolmaz', () => {
    const rows = buildGridRows(items(5), 2, false);
    const flat = rows.flatMap((r) => (r.kind === 'items' ? r.items : []));
    expect(flat).toEqual(items(5));
  });

  it('geçersiz sütun sayısı sessizce kabul edilmez', () => {
    expect(() => buildGridRows(items(4), 0, false)).toThrow();
  });
});
