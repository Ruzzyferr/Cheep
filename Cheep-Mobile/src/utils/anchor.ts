/**
 * 📍 Alışveriş çapası — "kullanıcı nerede alışveriş yapıyor?" sorusunun TEK kaynağı.
 *
 * Konum bilgisi eskiden üç yere dağılmıştı (user_country, user_location,
 * LocaleContext.country) ve aralarında tutarlılık kuralı yoktu. Burada tek bir
 * modelde toplanır. Çözümleme SAF bir fonksiyondur: React yok, ağ yok, GPS yok —
 * girdiler verilir, çapa çıkar. Bu sayede tüm konum davranışı doğrudan test edilir.
 */
import { storage, STORAGE_KEYS } from './storage';
import type { Coords } from './geo';

export type LocationMode = 'auto' | 'pinned';

/**
 * Yarıçap POLİTİKASI — çapa politikasının bir parçası olduğu için burada durur.
 *
 * Kimse market alışverişi için uzağa gitmez: kullanıcı karşılaştırma ekranında
 * hangi mesafedeki marketleri göreceğini seçer (yürüme / araba / geniş).
 *
 * MAX_RADIUS_KM, kullanıcının seçebileceği EN GENİŞ yarıçaptır. Bir koordinat
 * ancak bu yarıçap içinde en az bir şube varsa KULLANILABİLİR sayılır — aksi
 * halde kullanıcı hangi yarıçapı seçerse seçsin sonuç kümesi BOŞ kalır (boş
 * ekran). Bu sabit hem şube kapısında (geocode.service) hem de karşılaştırma
 * ekranında kullanılır; iki taraf birbirinden ayrı düşemesin diye TEK yerde.
 */
export const RADIUS_OPTIONS = [1.5, 3, 5] as const;
export const DEFAULT_RADIUS_KM = 3;
export const MAX_RADIUS_KM: number = Math.max(...RADIUS_OPTIONS);

/** Kullanıcının elle sabitlediği nokta. coords=null → doğrulanamadı, yalnızca ülke. */
export interface PinnedAnchor {
  coords: Coords | null;
  countryCode: string;
  label: string;
}

export interface ShoppingAnchor {
  mode: LocationMode;
  /** Mesafe/rota/yarıçap çapası. null → mesafe filtresi UYGULANMAZ. */
  coords: Coords | null;
  /** Katalog + para birimi (x-country). */
  countryCode: string;
  /** Sabitlenmiş modda gösterilecek etiket ("Warszawa"). Otomatik modda null. */
  label: string | null;
  resolvedAt: number;
}

export interface AnchorInput {
  mode: LocationMode;
  pinned: PinnedAnchor | null;
  /** Taze GPS koordinatı (rıza/izin yoksa veya GPS başarısızsa null). */
  gps: Coords | null;
  /** Reverse-geocode ISO kodu. DESTEKLENMEYEN ülke veya hata → null. */
  detectedCountry: string | null;
  /** Son bilinen ülke (user_country). Tespit başarısızsa buna düşülür. */
  lastCountry: string;
  now: number;
}

/**
 * Çapayı çözer.
 *
 * Otomatik modda GPS koordinatı YALNIZCA ülke tespit edilebildiyse kullanılır.
 * detectedCountry null ise (kullanıcı desteklenmeyen bir ülkede ya da geocode
 * başarısız) koordinat DÜŞÜRÜLÜR: Almanya'daki bir koordinatla Türk kataloğuna
 * yarıçap filtresi uygulamak sıfır sonuç üretir — "yakında market yok" hatasının
 * ta kendisi. Ülke ise asla sıfırlanmaz, son bilinen değer korunur.
 */
export function resolveAnchor(input: AnchorInput): ShoppingAnchor {
  const { mode, pinned, gps, detectedCountry, lastCountry, now } = input;

  if (mode === 'pinned' && pinned) {
    return {
      mode: 'pinned',
      coords: pinned.coords,
      countryCode: pinned.countryCode,
      label: pinned.label,
      resolvedAt: now,
    };
  }

  // mode 'pinned' ama pin yok → bozuk durum; otomatiğe düş.
  const countryCode = detectedCountry ?? lastCountry;
  const coords = gps && detectedCountry ? gps : null;

  return { mode: 'auto', coords, countryCode, label: null, resolvedAt: now };
}

/**
 * MERKEZÎ İNVARYANT: mesafe filtresi yalnızca çapa hem koordinatlı hem de
 * katalogla aynı ülkedeyse uygulanır. Tek karar noktası burasıdır — çağıranlar
 * kendi kuralını uydurmaz.
 */
export function shouldFilterByDistance(
  anchor: ShoppingAnchor,
  catalogCountry: string,
): boolean {
  return anchor.coords != null && anchor.countryCode === catalogCountry;
}

export const anchorStorage = {
  async getMode(): Promise<LocationMode> {
    return (await storage.getItem(STORAGE_KEYS.LOCATION_MODE)) === 'pinned'
      ? 'pinned'
      : 'auto';
  },

  async setMode(m: LocationMode): Promise<void> {
    await storage.setItem(STORAGE_KEYS.LOCATION_MODE, m);
  },

  async getPinned(): Promise<PinnedAnchor | null> {
    const raw = await storage.getItem(STORAGE_KEYS.PINNED_ANCHOR);
    if (!raw) return null;
    try {
      const p = JSON.parse(raw);
      if (typeof p?.countryCode !== 'string' || typeof p?.label !== 'string') return null;
      const coords =
        p.coords && typeof p.coords.lat === 'number' && typeof p.coords.lon === 'number'
          ? { lat: p.coords.lat, lon: p.coords.lon }
          : null;
      return { coords, countryCode: p.countryCode, label: p.label };
    } catch {
      return null;
    }
  },

  async setPinned(p: PinnedAnchor): Promise<void> {
    await storage.setItem(STORAGE_KEYS.PINNED_ANCHOR, JSON.stringify(p));
    await storage.setItem(STORAGE_KEYS.LOCATION_MODE, 'pinned');
  },

  async clearPin(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.PINNED_ANCHOR);
    await storage.setItem(STORAGE_KEYS.LOCATION_MODE, 'auto');
  },
};
