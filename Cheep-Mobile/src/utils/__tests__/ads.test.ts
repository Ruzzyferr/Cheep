import { describe, it, expect, vi, afterEach } from 'vitest';

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
import { shouldShowBanner, type AdSlot } from '../../config/ads';
import { buildGridRows, AD_AFTER_ROW, MIN_RESULTS_FOR_AD } from '../adRows';
/* eslint-enable import/first */

/**
 * Uygulamadaki TÜM banner yerleşimleri.
 *
 * ELLE TUTULAN LİSTE, bilerek: `AdSlot` bir tip, çalışma anında
 * numaralandırılamıyor. Buraya eklemeyi unutmak testlerin yuvayı atlamasına
 * yol açardı — bunu engelleyen şey aşağıdaki `satisfies`: `AdSlot`a yeni bir
 * değer eklenip buraya eklenmezse `eksiksizMi` DERLENMEZ.
 */
const TUM_YUVALAR = ['home', 'search', 'list', 'detail', 'category', 'lists', 'deals'] as const;

/** `AdSlot`un her üyesi listede var mı? Eksikse tip hatası verir. */
const _eksiksizMi: Record<AdSlot, true> = Object.fromEntries(
  TUM_YUVALAR.map((s) => [s, true]),
) as Record<(typeof TUM_YUVALAR)[number], true>;
void _eksiksizMi;

/** Her yuvası dolu, geçerli bir Android ortamı. */
const tamOrtam = (): Record<string, string> =>
  Object.fromEntries(
    TUM_YUVALAR.map((s) => [`EXPO_PUBLIC_ADMOB_BANNER_${s.toUpperCase()}_ANDROID`, `ca-app-pub-1/${s}`]),
  );

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

/**
 * Birim kimliği seçimi.
 *
 * ORTAMI TEST KENDİSİ KURUYOR. Bu testler eskiden ortamda hiçbir AdMob
 * değişkeni OLMADIĞINI varsayıyordu; yerelde doğruydu ama CI'da gerçek
 * kimlikler repo değişkeni olarak tanımlanınca "kimlik yoksa test birimine
 * düşer" testi kırıldı — kod değil, testin varsayımı yanlıştı. Değişkenler
 * modül YÜKLENİRKEN okunduğu için her senaryoda modül yeniden import ediliyor.
 */
describe('reklam birimi kimliği', () => {
  // TÜRETİLMİŞ, elle yazılmış DEĞİL: liste sabit kaldığında yeni bir yuvanın
  // değişkeni testler arasında temizlenmiyor ve önceki testten SIZIYOR —
  // sonraki test yanlış yere "yapılandırma tam" görüyordu.
  const ANAHTARLAR = TUM_YUVALAR.flatMap((s) => [
    `EXPO_PUBLIC_ADMOB_BANNER_${s.toUpperCase()}_ANDROID`,
    `EXPO_PUBLIC_ADMOB_BANNER_${s.toUpperCase()}_IOS`,
  ]);

  async function tazeModul(ortam: Record<string, string | undefined>) {
    for (const k of ANAHTARLAR) delete process.env[k];
    for (const [k, v] of Object.entries(ortam)) if (v) process.env[k] = v;
    vi.resetModules();
    return import('../../config/ads');
  }

  afterEach(() => {
    for (const k of ANAHTARLAR) delete process.env[k];
    vi.resetModules();
  });

  it('gerçek kimlik yokken GOOGLE TEST birimine düşer', async () => {
    // Geliştirmede GERÇEK birim kullanmak "geçersiz trafik" sayılıp AdMob
    // hesabını askıya aldırır. Yapılandırmayı unutmanın bedeli gelir kaybı
    // olmalı, hesap kaybı değil.
    const { bannerUnitId: f } = await tazeModul({});
    for (const slot of TUM_YUVALAR) {
      expect(f(slot)).toBe('ca-app-pub-3940256099942544/6300978111');
    }
  });

  it('tanılama kipi gerçek kimlikleri EZER (test birimine düşer)', async () => {
    // "Banner görünmüyor"un iki sebebi ekranda aynı görünüyor: entegrasyon
    // bozuk olabilir ya da Google dolum vermemiş olabilir. Tanılama kipi
    // ikisini ayırıyor — ve bunu YAPABİLMESİ için gerçek kimlikler
    // tanımlıyken bile test birimini döndürmesi şart.
    const { bannerUnitId: f } = await tazeModul({
      EXPO_PUBLIC_ADMOB_BANNER_HOME_ANDROID: 'ca-app-pub-1/11',
      EXPO_PUBLIC_ADMOB_BANNER_SEARCH_ANDROID: 'ca-app-pub-1/22',
      EXPO_PUBLIC_ADMOB_BANNER_LIST_ANDROID: 'ca-app-pub-1/33',
    });
    for (const slot of ['home', 'search', 'list'] as const) {
      expect(f(slot, true)).toBe('ca-app-pub-3940256099942544/6300978111');
      // Kip kapalıyken hiçbir şey değişmemeli.
      expect(f(slot, false)).not.toBe('ca-app-pub-3940256099942544/6300978111');
    }
  });

  it('gerçek kimlikler tanımlıysa ONLARI kullanır', async () => {
    const { bannerUnitId: f } = await tazeModul(tamOrtam());
    for (const slot of TUM_YUVALAR) {
      expect(f(slot)).toBe(`ca-app-pub-1/${slot}`);
    }
    // Her yuva AYRI birim olmak zorunda: AdMob raporu birim bazında kırılıyor,
    // tek birim paylaşılsa hangi yerleşimin gelir ürettiği hiç öğrenilemezdi.
    expect(new Set(TUM_YUVALAR.map((s) => f(s))).size).toBe(TUM_YUVALAR.length);
  });

  it('PLATFORMUN kendi kimliğini okur — diğer platformunkini DEĞİL', async () => {
    // AdMob birimi platforma özel; Android birimini iOS'ta kullanmak reklam
    // gelmemesi ve raporun karışması demek. Bu mock Android.
    const { bannerUnitId: f } = await tazeModul({
      EXPO_PUBLIC_ADMOB_BANNER_HOME_ANDROID: 'ca-app-pub-1/android',
      EXPO_PUBLIC_ADMOB_BANNER_HOME_IOS: 'ca-app-pub-1/ios',
    });
    expect(f('home')).toBe('ca-app-pub-1/android');
  });

  it('bozuk bir değer test birimine düşürür (sessizce yanlış kimlik kullanmaz)', async () => {
    const { bannerUnitId: f } = await tazeModul({
      EXPO_PUBLIC_ADMOB_BANNER_HOME_ANDROID: 'bozuk-deger',
    });
    expect(f('home')).toBe('ca-app-pub-3940256099942544/6300978111');
  });

  it('hasRealAdUnits yapılandırmanın TAM olup olmadığını bildirir', async () => {
    const bos = await tazeModul({});
    expect(bos.hasRealAdUnits()).toBe(false);

    const yarim = await tazeModul({ EXPO_PUBLIC_ADMOB_BANNER_HOME_ANDROID: 'ca-app-pub-1/11' });
    expect(yarim.hasRealAdUnits()).toBe(false); // HEPSİ dolu olmalı

    expect((await tazeModul(tamOrtam())).hasRealAdUnits()).toBe(true);
  });

  it('YENİ BİR YUVA ortam değişkenini unutturamaz', async () => {
    // Bu testin tek işi: `AdSlot`a yuva eklenip ortam değişkeni eklenmediğinde
    // KIRILMAK. Yapılandırılmamış bir yuva sessizce Google'ın test birimine
    // düşer — yani gerçek kullanıcıya "Test Ad" yazan bir kutu gösterir ve
    // hiç gelir üretmez. Derleyici bunu yakalamaz, çünkü değer `undefined`
    // olmaya zaten izinli.
    const tam = tamOrtam();
    for (const slot of TUM_YUVALAR) {
      const eksik = { ...tam };
      delete eksik[`EXPO_PUBLIC_ADMOB_BANNER_${slot.toUpperCase()}_ANDROID`];
      const m = await tazeModul(eksik);
      expect(m.hasRealAdUnits()).toBe(false);
      expect(m.bannerUnitId(slot)).toBe('ca-app-pub-3940256099942544/6300978111');
    }
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
