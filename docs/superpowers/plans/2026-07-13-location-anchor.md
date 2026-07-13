# Alışveriş Çapası (ShoppingAnchor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konumu ve ülkeyi tek bir "alışveriş çapası"na indirip her açılışta tazelemek; kullanıcı seyahat edince ülkenin kendini güncellemesini, uzaktan bakmak isteyene ise doğrulanmış bir adres sabitlemesini sağlamak.

**Architecture:** Üç dağınık durum (`user_country`, `user_location`, `LocaleContext.country`) tek bir `ShoppingAnchor` altında toplanır. Çapa çözümlemesi **saf bir fonksiyondur** (`resolveAnchor`), React'ten bağımsızdır ve doğrudan test edilir; `LocationProvider` yalnızca ince bir kabuktur (GPS oku → çöz → yay). Merkezî invaryant tek bir yerde yaşar: `shouldFilterByDistance()`.

**Tech Stack:** React Native 0.81 / Expo 54, TypeScript (strict), expo-location, expo-secure-store, i18next (5 dil), vitest.

## Global Constraints

- **Merkezî invaryant:** `userLocation` + `radiusKm` yalnızca `anchor.coords != null && anchor.countryCode === catalogCountry` iken gönderilir. Aksi halde İKİSİ DE gönderilmez.
- **Belirsizlik varsa mesafe filtresi kapanır.** Yanlış noktayla filtrelemek boş ekran üretir; filtrelememek en fazla fazladan market gösterir.
- **Desteklenen ülkeler:** yalnızca `SUPPORTED_COUNTRY_CODES = ['TR','PL']` (`src/utils/geo.ts:20`).
- **Ülke asla varsayılana sıfırlanmaz.** Tespit başarısızsa son bilinen ülke korunur.
- **Backend değişikliği YOK.**
- **Yeni kullanıcıya görünen her metin 5 dilde:** `src/i18n/locales/{tr,en,pl,de,sv}.json`. Sabit Türkçe string YASAK (PL lansmanı canlı).
- **Test koşucusu vitest**, yalnızca saf TS'i test eder (`npx vitest run`). RN bileşenleri render EDİLMEZ — UI doğrulaması manueldir ve Task 7'de listelenmiştir.
- Her task sonunda: `npx vitest run` + `npx tsc --noEmit` + `npx expo lint` (0 hata).

---

## File Structure

**Yeni:**
- `src/utils/anchor.ts` — tipler, depolama, saf kurallar (`resolveAnchor`, `shouldFilterByDistance`)
- `src/services/geocode.service.ts` — adres arama + üç doğrulama kapısı
- `src/context/LocationContext.tsx` — provider: kapı → GPS → çöz → yay; ülke otomatik geçişi
- `src/components/location/LocationSheet.tsx` — mod seçimi, adres girişi, aday onayı
- `src/components/location/CountryChangedBanner.tsx` — otomatik ülke geçişi şeridi
- `src/utils/__tests__/anchor.test.ts`, `src/services/__tests__/geocode.test.ts`

**Değişecek:**
- `src/utils/storage.ts` — çapa anahtarları
- `src/utils/geo.ts` — `reverseGeocodeCountry(coords)` dışa aç
- `src/services/api.client.ts:55-59` — açıkça verilmiş `x-country`'yi EZME
- `src/services/store.service.ts:34-39` — `getNearbyStores`'a ülke override'ı
- `src/screens/lists/CompareResultsScreen.tsx:54-96` — çapayı context'ten oku
- `src/screens/home/NewHomeScreen.tsx:64-75` — ilk-çalıştırma geo fallback'ini SİL (artık provider sahibi)
- `src/navigation/RootNavigator.tsx` — `useLocationGate` çağrısını KALDIR (provider'a taşındı)
- `App.tsx` — `LocationProvider` mount
- `src/screens/profile/ProfileScreen.tsx:195-205` — ülke satırı `LocationSheet` açsın
- `src/i18n/locales/*.json` ×5

---

### Task 1: Çapa modeli, depolama ve saf kurallar

Tüm sistemin kalbi. Saf TypeScript — React yok, ağ yok, tam test edilebilir.

**Files:**
- Create: `Cheep-Mobile/src/utils/anchor.ts`
- Create: `Cheep-Mobile/src/utils/__tests__/anchor.test.ts`
- Modify: `Cheep-Mobile/src/utils/storage.ts` (STORAGE_KEYS'e 2 anahtar)

**Interfaces:**
- Consumes: `Coords` (`src/utils/geo.ts:10`), `storage` + `STORAGE_KEYS` (`src/utils/storage.ts:39,25`)
- Produces:
  - `type LocationMode = 'auto' | 'pinned'`
  - `interface PinnedAnchor { coords: Coords | null; countryCode: string; label: string }`
  - `interface ShoppingAnchor { mode: LocationMode; coords: Coords | null; countryCode: string; label: string | null; resolvedAt: number }`
  - `interface AnchorInput { mode: LocationMode; pinned: PinnedAnchor | null; gps: Coords | null; detectedCountry: string | null; lastCountry: string; now: number }`
  - `function resolveAnchor(input: AnchorInput): ShoppingAnchor`
  - `function shouldFilterByDistance(anchor: ShoppingAnchor, catalogCountry: string): boolean`
  - `const anchorStorage: { getMode(): Promise<LocationMode>; setMode(m: LocationMode): Promise<void>; getPinned(): Promise<PinnedAnchor | null>; setPinned(p: PinnedAnchor): Promise<void>; clearPin(): Promise<void> }`

- [ ] **Step 1: STORAGE_KEYS'e iki anahtar ekle**

`src/utils/storage.ts` içinde, `LOCATION_PROMPT_SNOOZE` satırının hemen ardına:

```ts
  LOCATION_MODE: 'location_mode',           // 'auto' | 'pinned'
  PINNED_ANCHOR: 'pinned_anchor',           // JSON: PinnedAnchor
```

- [ ] **Step 2: Başarısız testi yaz**

`src/utils/__tests__/anchor.test.ts`:

```ts
/**
 * Çapa çözümlemesi — saf kurallar. Tüm konum/ülke davranışı buradan türer.
 */
import { describe, it, expect, vi } from 'vitest';

const mem = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  setItemAsync: async (k: string, v: string) => void mem.set(k, v),
  getItemAsync: async (k: string) => mem.get(k) ?? null,
  deleteItemAsync: async (k: string) => void mem.delete(k),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { resolveAnchor, shouldFilterByDistance, anchorStorage } from '../anchor';
import type { ShoppingAnchor } from '../anchor';

const IZMIR = { lat: 38.42, lon: 27.14 };
const WARSAW = { lat: 52.23, lon: 21.01 };
const NOW = 1_700_000_000_000;

describe('resolveAnchor — otomatik mod', () => {
  it('GPS + desteklenen ülke → koordinatlı çapa, ülke güncellenir', () => {
    const a = resolveAnchor({
      mode: 'auto', pinned: null, gps: WARSAW,
      detectedCountry: 'PL', lastCountry: 'TR', now: NOW,
    });
    expect(a).toEqual({
      mode: 'auto', coords: WARSAW, countryCode: 'PL', label: null, resolvedAt: NOW,
    });
  });

  it('desteklenmeyen ülke (detectedCountry=null) → son ülke korunur, KOORDİNAT KULLANILMAZ', () => {
    // Kullanıcı Almanya'da. GPS var ama ülke desteklenmiyor. Alman koordinatıyla
    // Türk kataloğunu filtrelersek 0 sonuç çıkar — tam da düzelttiğimiz hata.
    const a = resolveAnchor({
      mode: 'auto', pinned: null, gps: { lat: 52.52, lon: 13.4 },
      detectedCountry: null, lastCountry: 'TR', now: NOW,
    });
    expect(a.countryCode).toBe('TR');
    expect(a.coords).toBeNull();
  });

  it('GPS yok (izin/rıza yok) → koordinatsız, son ülke korunur', () => {
    const a = resolveAnchor({
      mode: 'auto', pinned: null, gps: null,
      detectedCountry: null, lastCountry: 'PL', now: NOW,
    });
    expect(a.coords).toBeNull();
    expect(a.countryCode).toBe('PL');
  });
});

describe('resolveAnchor — sabitlenmiş mod', () => {
  it('pin GPS’i EZER: kullanıcı İzmir’de ama Varşova’ya sabitlemiş', () => {
    const a = resolveAnchor({
      mode: 'pinned',
      pinned: { coords: WARSAW, countryCode: 'PL', label: 'Warszawa' },
      gps: IZMIR, detectedCountry: 'TR', lastCountry: 'TR', now: NOW,
    });
    expect(a).toEqual({
      mode: 'pinned', coords: WARSAW, countryCode: 'PL', label: 'Warszawa', resolvedAt: NOW,
    });
  });

  it('koordinatsız pin (şube bulunamamıştı) → yalnızca ülke sabitlenir', () => {
    const a = resolveAnchor({
      mode: 'pinned',
      pinned: { coords: null, countryCode: 'PL', label: 'Polonya' },
      gps: IZMIR, detectedCountry: 'TR', lastCountry: 'TR', now: NOW,
    });
    expect(a.coords).toBeNull();
    expect(a.countryCode).toBe('PL');
  });

  it('mod pinned ama pin yoksa otomatiğe düşer (bozuk durum kurtarma)', () => {
    const a = resolveAnchor({
      mode: 'pinned', pinned: null, gps: IZMIR,
      detectedCountry: 'TR', lastCountry: 'TR', now: NOW,
    });
    expect(a.mode).toBe('auto');
    expect(a.coords).toEqual(IZMIR);
  });
});

describe('shouldFilterByDistance — MERKEZÎ İNVARYANT', () => {
  const base: ShoppingAnchor = {
    mode: 'auto', coords: IZMIR, countryCode: 'TR', label: null, resolvedAt: NOW,
  };

  it('koordinat var + ülke eşleşiyor → filtre AÇIK', () => {
    expect(shouldFilterByDistance(base, 'TR')).toBe(true);
  });

  it('koordinat var ama ülke eşleşmiyor → filtre KAPALI', () => {
    expect(shouldFilterByDistance(base, 'PL')).toBe(false);
  });

  it('koordinat yok → filtre KAPALI', () => {
    expect(shouldFilterByDistance({ ...base, coords: null }, 'TR')).toBe(false);
  });
});

describe('anchorStorage', () => {
  it('varsayılan mod auto', async () => {
    mem.clear();
    expect(await anchorStorage.getMode()).toBe('auto');
  });

  it('setPinned modu pinned yapar; clearPin auto’ya döndürür ve pini siler', async () => {
    mem.clear();
    await anchorStorage.setPinned({ coords: WARSAW, countryCode: 'PL', label: 'Warszawa' });
    expect(await anchorStorage.getMode()).toBe('pinned');
    expect(await anchorStorage.getPinned()).toEqual({
      coords: WARSAW, countryCode: 'PL', label: 'Warszawa',
    });

    await anchorStorage.clearPin();
    expect(await anchorStorage.getMode()).toBe('auto');
    expect(await anchorStorage.getPinned()).toBeNull();
  });

  it('bozuk JSON → null (çökme yok)', async () => {
    mem.clear();
    mem.set('pinned_anchor', '{bozuk');
    expect(await anchorStorage.getPinned()).toBeNull();
  });
});
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `cd Cheep-Mobile && npx vitest run src/utils/__tests__/anchor.test.ts`
Expected: FAIL — `Failed to resolve import "../anchor"`

- [ ] **Step 4: `src/utils/anchor.ts` yaz**

```ts
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
```

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Run: `npx vitest run src/utils/__tests__/anchor.test.ts`
Expected: PASS (13 test)

- [ ] **Step 6: Tam doğrulama + commit**

```bash
npx vitest run && npx tsc --noEmit && npx expo lint
git add src/utils/anchor.ts src/utils/__tests__/anchor.test.ts src/utils/storage.ts
git commit -m "feat(mobile): alışveriş çapası modeli — saf çözümleme + merkezî mesafe invaryantı"
```

---

### Task 2: `x-country` override'ı ve ülke-hedefli yakın market sorgusu

Bir pini doğrulamak için, kullanıcının HENÜZ geçmediği ülkede şube var mı diye sormamız gerekir. Bugün `api.client` interceptor'ı `x-country`'yi koşulsuz eziyor, yani başka bir ülkeye sorgu atmak imkânsız.

**Files:**
- Modify: `Cheep-Mobile/src/services/api.client.ts:55-59`
- Modify: `Cheep-Mobile/src/services/store.service.ts:34-39`

**Interfaces:**
- Produces: `storeService.getNearbyStores(lat: number, lon: number, countryCode?: string): Promise<NearbyStore[]>`

- [ ] **Step 1: Interceptor açıkça verilmiş header'ı ezmesin**

`src/services/api.client.ts`, mevcut 55-59'u değiştir:

```ts
    // Ülke scoping: saklanan ISO ülke kodunu x-country header'ı olarak gönder.
    // Çağıran AÇIKÇA bir x-country verdiyse ONA dokunma — pin doğrulaması,
    // kullanıcının henüz geçmediği bir ülkeye sorgu atmak zorunda.
    if (config.headers && !config.headers['x-country']) {
      const country = await countryStorage.getCountry();
      if (country) {
        config.headers['x-country'] = country;
      }
    }
```

- [ ] **Step 2: `getNearbyStores`'a ülke parametresi ekle**

`src/services/store.service.ts`, mevcut 31-39'u değiştir:

```ts
  /**
   * Get nearest store branches to a given coordinate.
   *
   * countryCode verilirse o ülkeye sorulur (saklanan ülke yerine) — pin
   * doğrulaması için: "bu adresin çevresinde gerçekten market var mı?"
   */
  async getNearbyStores(lat: number, lon: number, countryCode?: string): Promise<NearbyStore[]> {
    const response = await apiClient.get<ApiResponse<NearbyStore[]>>(
      API_ENDPOINTS.STORES.NEARBY,
      {
        params: { lat, lon },
        ...(countryCode ? { headers: { 'x-country': countryCode } } : {}),
      },
    );
    return response.data.data || [];
  },
```

- [ ] **Step 3: Doğrulama + commit**

```bash
npx tsc --noEmit && npx expo lint && npx vitest run
git add src/services/api.client.ts src/services/store.service.ts
git commit -m "feat(mobile): x-country override — pin doğrulaması için hedef ülkeye sorgu"
```

---

### Task 3: Geocode servisi ve üç doğrulama kapısı

Serbest adres girişinin bilinen zayıflığı sessiz yanlış eşleşmedir. Üç kapı bunu engeller.

**Files:**
- Create: `Cheep-Mobile/src/services/geocode.service.ts`
- Create: `Cheep-Mobile/src/services/__tests__/geocode.test.ts`
- Modify: `Cheep-Mobile/src/utils/geo.ts` (`reverseGeocodeCountry` dışa aç)

**Interfaces:**
- Consumes: `PinnedAnchor` (Task 1), `storeService.getNearbyStores(lat, lon, countryCode)` (Task 2), `SUPPORTED_COUNTRY_CODES` (`geo.ts:20`)
- Produces:
  - `interface GeocodeCandidate { label: string; coords: Coords; countryCode: string | null }`
  - `interface SearchResult { available: boolean; candidates: GeocodeCandidate[] }`
  - `function searchAddress(query: string): Promise<SearchResult>`
  - `type Validation = { status: 'ok'; pin: PinnedAnchor } | { status: 'no_branches'; pin: PinnedAnchor } | { status: 'unsupported_country' }`
  - `function validateCandidate(c: GeocodeCandidate): Promise<Validation>`
  - `function reverseGeocodeCountry(coords: Coords): Promise<string | null>` (geo.ts'ten)

- [ ] **Step 1: `geo.ts`'e `reverseGeocodeCountry` ekle**

`src/utils/geo.ts` sonuna:

```ts
/**
 * Verilen koordinatın ISO ülke kodunu çözer. Desteklenmeyen ülke veya hata → null.
 * (getCountryCode'dan farkı: GPS okumaz, verilen koordinatı çözer — çapa akışında
 * konum zaten elimizde, ikinci kez GPS istemek gereksiz.)
 */
export async function reverseGeocodeCountry(coords: Coords): Promise<string | null> {
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lon,
    });
    const iso = places[0]?.isoCountryCode?.toUpperCase();
    return iso && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(iso) ? iso : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Başarısız testi yaz**

`src/services/__tests__/geocode.test.ts`:

```ts
/**
 * Adres → çapa. Üç kapı sessiz yanlış eşleşmeyi engeller:
 *   1) ülke kapısı  2) şube kapısı  3) geocoder yokluğu
 */
/* eslint-disable import/first -- vi.mock fabrikaları aşağıdaki sabitlere kapanır. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const geo = {
  available: true,
  results: [] as { latitude: number; longitude: number }[],
  reverse: [] as { isoCountryCode?: string; city?: string; district?: string }[],
};
vi.mock('expo-location', () => ({
  Accuracy: { Low: 1, Balanced: 3 },
  geocodeAsync: async () => {
    if (!geo.available) throw new Error('Geocoder unavailable');
    return geo.results;
  },
  reverseGeocodeAsync: async () => geo.reverse,
}));

const branches = { count: 0 };
vi.mock('../store.service', () => ({
  storeService: {
    getNearbyStores: async () =>
      Array.from({ length: branches.count }, (_, i) => ({ id: i })),
  },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-secure-store', () => ({
  setItemAsync: async () => {},
  getItemAsync: async () => null,
  deleteItemAsync: async () => {},
}));

import { searchAddress, validateCandidate } from '../geocode.service';

const WARSAW = { lat: 52.23, lon: 21.01 };

beforeEach(() => {
  geo.available = true;
  geo.results = [];
  geo.reverse = [];
  branches.count = 0;
});

describe('searchAddress', () => {
  it('geocoder yoksa available=false döner (sessizce boş liste DEĞİL)', async () => {
    geo.available = false;
    const r = await searchAddress('Marszałkowska 1');
    expect(r).toEqual({ available: false, candidates: [] });
  });

  it('sonuçları ülke kodu + etiketle birlikte döner', async () => {
    geo.results = [{ latitude: 52.23, longitude: 21.01 }];
    geo.reverse = [{ isoCountryCode: 'pl', city: 'Warszawa', district: 'Śródmieście' }];

    const r = await searchAddress('Marszałkowska 1');

    expect(r.available).toBe(true);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].coords).toEqual(WARSAW);
    expect(r.candidates[0].countryCode).toBe('PL');
    expect(r.candidates[0].label).toContain('Warszawa');
  });

  it('sonuç yoksa boş liste ama available=true', async () => {
    geo.results = [];
    const r = await searchAddress('zzzz');
    expect(r).toEqual({ available: true, candidates: [] });
  });
});

describe('validateCandidate — 1. kapı: ülke', () => {
  it('desteklenmeyen ülke reddedilir', async () => {
    const v = await validateCandidate({
      label: 'Berlin', coords: { lat: 52.52, lon: 13.4 }, countryCode: null,
    });
    expect(v).toEqual({ status: 'unsupported_country' });
  });
});

describe('validateCandidate — 2. kapı: şube', () => {
  it('çevrede şube varsa KOORDİNATLI pin döner', async () => {
    branches.count = 5;
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'ok',
      pin: { coords: WARSAW, countryCode: 'PL', label: 'Warszawa' },
    });
  });

  it('çevrede şube YOKSA pin KOORDİNATSIZ döner — yoksa boş ekran üretirdi', async () => {
    branches.count = 0;
    const v = await validateCandidate({
      label: 'Warszawa', coords: WARSAW, countryCode: 'PL',
    });
    expect(v).toEqual({
      status: 'no_branches',
      pin: { coords: null, countryCode: 'PL', label: 'Warszawa' },
    });
  });
});
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `npx vitest run src/services/__tests__/geocode.test.ts`
Expected: FAIL — `Failed to resolve import "../geocode.service"`

- [ ] **Step 4: `src/services/geocode.service.ts` yaz**

```ts
/**
 * 🔎 Adres → alışveriş çapası.
 *
 * Serbest adres girişinin bilinen zayıflığı SESSİZ YANLIŞ EŞLEŞMEDİR: geocoder
 * yanlış bir noktayı döndürür, uygulama onu sorgusuz kabul eder, kullanıcı yanlış
 * mesafeler görür. Üç kapı bunu engeller:
 *   1) Ülke kapısı  — nokta TR/PL dışındaysa reddet.
 *   2) Şube kapısı  — çevresinde market yoksa KOORDİNATSIZ pin ver (yalnızca ülke),
 *                     aksi halde yarıçap filtresi boş ekran üretir.
 *   3) Geocoder yok — bazı Android'lerde geocodeAsync çalışmaz; bunu sessiz "sonuç
 *                     yok" gibi göstermek yerine açıkça bildir.
 */
import * as Location from 'expo-location';
import { storeService } from './store.service';
import { SUPPORTED_COUNTRY_CODES, type Coords } from '../utils/geo';
import type { PinnedAnchor } from '../utils/anchor';

export interface GeocodeCandidate {
  label: string;
  coords: Coords;
  /** Desteklenen ülke değilse null. */
  countryCode: string | null;
}

export interface SearchResult {
  /** false → cihazın geocoder'ı yok/çalışmıyor (boş sonuçtan FARKLI). */
  available: boolean;
  candidates: GeocodeCandidate[];
}

export type Validation =
  | { status: 'ok'; pin: PinnedAnchor }
  | { status: 'no_branches'; pin: PinnedAnchor }
  | { status: 'unsupported_country' };

/** En fazla kaç aday gösterilir — kullanıcı hangisini kastettiğini seçecek. */
const MAX_CANDIDATES = 5;

function labelOf(
  place: { city?: string | null; district?: string | null; region?: string | null; name?: string | null },
  fallback: string,
): string {
  const parts = [place.city ?? place.region, place.district ?? place.name].filter(
    (p): p is string => !!p,
  );
  return parts.length ? [...new Set(parts)].join(', ') : fallback;
}

export async function searchAddress(query: string): Promise<SearchResult> {
  let results: Location.LocationGeocodedLocation[];
  try {
    results = await Location.geocodeAsync(query);
  } catch {
    // Cihazda geocoder yok (ör. Play Services'sız Android) — sessizce "bulunamadı"
    // demek yanıltıcı olur; çağıran ayrı bir mesaj göstermeli.
    return { available: false, candidates: [] };
  }

  const candidates: GeocodeCandidate[] = [];
  for (const r of results.slice(0, MAX_CANDIDATES)) {
    const coords: Coords = { lat: r.latitude, lon: r.longitude };
    let countryCode: string | null = null;
    let label = query;
    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: r.latitude,
        longitude: r.longitude,
      });
      const p = places[0];
      const iso = p?.isoCountryCode?.toUpperCase();
      countryCode =
        iso && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(iso) ? iso : null;
      if (p) label = labelOf(p, query);
    } catch {
      /* ülke çözülemedi → countryCode null kalır, ülke kapısı reddeder */
    }
    candidates.push({ label, coords, countryCode });
  }

  return { available: true, candidates };
}

export async function validateCandidate(c: GeocodeCandidate): Promise<Validation> {
  // 1. kapı — ülke.
  if (!c.countryCode) return { status: 'unsupported_country' };

  // 2. kapı — şube. Çevresinde hiç market yoksa koordinatı KULLANMA: yarıçap
  // filtresi her şeyi eler ve kullanıcı boş ekran görür.
  let hasBranches = false;
  try {
    const nearby = await storeService.getNearbyStores(c.coords.lat, c.coords.lon, c.countryCode);
    hasBranches = nearby.length > 0;
  } catch {
    hasBranches = false; // ağ hatası → temkinli davran, mesafeleri kapat
  }

  const pin: PinnedAnchor = {
    coords: hasBranches ? c.coords : null,
    countryCode: c.countryCode,
    label: c.label,
  };
  return hasBranches ? { status: 'ok', pin } : { status: 'no_branches', pin };
}
```

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Run: `npx vitest run src/services/__tests__/geocode.test.ts`
Expected: PASS (6 test)

- [ ] **Step 6: Doğrulama + commit**

```bash
npx vitest run && npx tsc --noEmit && npx expo lint
git add src/services/geocode.service.ts src/services/__tests__/geocode.test.ts src/utils/geo.ts
git commit -m "feat(mobile): geocode servisi — ülke, şube ve geocoder-yokluğu kapıları"
```

---

### Task 4: LocationProvider — kapı, GPS, çözümleme, ülke otomatik geçişi

Provider ince bir kabuktur: izin kapısını çalıştır → GPS oku → `resolveAnchor` ile çöz → yay. Konum kapısı buraya taşınır; iki ayrı `AppState` dinleyicisi kalmaz ve GPS okuması izin alınmadan başlamaz (aksi halde iki rıza diyaloğu üst üste açılabilirdi).

**Files:**
- Create: `Cheep-Mobile/src/context/LocationContext.tsx`
- Modify: `Cheep-Mobile/App.tsx` (provider mount)
- Modify: `Cheep-Mobile/src/navigation/RootNavigator.tsx` (`useLocationGate` çağrısını kaldır)
- Modify: `Cheep-Mobile/src/screens/home/NewHomeScreen.tsx:64-75` (ilk-çalıştırma geo fallback'ini sil)
- Delete: `Cheep-Mobile/src/hooks/useLocationGate.ts` (mantığı provider'a taşındı)

**Interfaces:**
- Consumes: `resolveAnchor`, `anchorStorage`, `ShoppingAnchor`, `PinnedAnchor` (Task 1); `reverseGeocodeCountry` (Task 3); `runLocationGate` (`src/utils/locationGate.ts`); `getUserLocation` (`geo.ts:64`); `useLocale().setCountry`; `countryStorage`
- Produces:
  - `function LocationProvider({ children }: { children: ReactNode }): JSX.Element`
  - `function useLocationAnchor(): { anchor: ShoppingAnchor | null; refresh: () => Promise<void>; pin: (p: PinnedAnchor) => Promise<void>; unpin: () => Promise<void>; countryChangedTo: string | null; dismissCountryNotice: () => void }`

- [ ] **Step 1: `src/context/LocationContext.tsx` yaz**

```tsx
/**
 * 📍 Alışveriş çapasının tek sahibi.
 *
 * Sıra ÖNEMLİ: önce izin kapısı, sonra GPS. Kapı ayrı bir yerde koşsaydı, provider
 * aynı anda getUserLocation() çağırıp ikinci bir rıza diyaloğu açabilirdi.
 *
 * Yalnızca ana uygulamada çalışır (auth + doğrulama + onboarding + intro tamam) —
 * onboarding'in kendi konum-rıza istemiyle çakışmasın.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { useLocale } from './LocaleContext';
import { getUserLocation, reverseGeocodeCountry } from '../utils/geo';
import { runLocationGate } from '../utils/locationGate';
import {
  anchorStorage, resolveAnchor, type PinnedAnchor, type ShoppingAnchor,
} from '../utils/anchor';
import { countryStorage } from '../utils/storage';
import { userService } from '../services';

interface LocationValue {
  /** null = henüz çözülmedi (ilk render). */
  anchor: ShoppingAnchor | null;
  refresh: () => Promise<void>;
  pin: (p: PinnedAnchor) => Promise<void>;
  unpin: () => Promise<void>;
  /** Otomatik ülke geçişi olduysa yeni ülke kodu — şerit bunu gösterir. */
  countryChangedTo: string | null;
  dismissCountryNotice: () => void;
}

const Ctx = createContext<LocationValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, emailVerified, onboardingDone, introSeen } = useAuth();
  const { setCountry } = useLocale();

  const [anchor, setAnchor] = useState<ShoppingAnchor | null>(null);
  const [countryChangedTo, setCountryChangedTo] = useState<string | null>(null);

  const enabled = isAuthenticated && emailVerified && onboardingDone && introSeen;
  const runningRef = useRef(false);
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const mode = await anchorStorage.getMode();
      const pinned = await anchorStorage.getPinned();
      const lastCountry = (await countryStorage.getCountry()) ?? 'TR';

      let gps = null;
      let detectedCountry: string | null = null;
      if (mode !== 'pinned' || !pinned) {
        // Otomatik mod: önce izin kapısı, SONRA konum.
        await runLocationGate();
        gps = await getUserLocation();
        if (gps) detectedCountry = await reverseGeocodeCountry(gps);
      }

      const next = resolveAnchor({
        mode, pinned, gps, detectedCountry, lastCountry, now: Date.now(),
      });
      setAnchor(next);

      if (next.countryCode !== lastCountry) {
        // Ülke kendini güncelledi (kullanıcı seyahat etti ya da pin değişti).
        await setCountry(next.countryCode);
        setCountryChangedTo(next.countryCode);
        try {
          await userService.updatePreferences({ country_code: next.countryCode });
        } catch {
          /* sunucu tercihi kaydedilemedi — yerel durum yine de doğru */
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [setCountry]);

  useEffect(() => {
    if (!enabled) return;
    refresh();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = prevAppState.current;
      prevAppState.current = next;
      // Yalnızca gerçek arka plan → ön geçişinde. 'inactive' → 'active' atlanır:
      // iOS'ta sistem izin modalı uygulamayı inactive yapıp geri getiriyor.
      if (prev === 'background' && next === 'active') refresh();
    });
    return () => sub.remove();
  }, [enabled, refresh]);

  const pin = useCallback(async (p: PinnedAnchor) => {
    await anchorStorage.setPinned(p);
    await refresh();
  }, [refresh]);

  const unpin = useCallback(async () => {
    await anchorStorage.clearPin();
    await refresh();
  }, [refresh]);

  const dismissCountryNotice = useCallback(() => setCountryChangedTo(null), []);

  return (
    <Ctx.Provider
      value={{ anchor, refresh, pin, unpin, countryChangedTo, dismissCountryNotice }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLocationAnchor(): LocationValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocationAnchor must be used within LocationProvider');
  return ctx;
}
```

- [ ] **Step 2: `App.tsx`'te provider'ı mount et**

`App.tsx` içindeki ağacı değiştir (import'a `LocationProvider` ekle):

```tsx
import { LocationProvider } from './src/context/LocationContext';
...
            <AuthProvider>
              <LocationProvider>
                <RootNavigator />
              </LocationProvider>
            </AuthProvider>
```

- [ ] **Step 3: `RootNavigator`'dan kapıyı kaldır**

`src/navigation/RootNavigator.tsx` içinden şu üç şeyi SİL:
- `import { useLocationGate } from '../hooks/useLocationGate';`
- `const inMainApp = ...` satırı
- `useLocationGate(inMainApp);` satırı

Ardından dosyayı sil: `rm src/hooks/useLocationGate.ts`

- [ ] **Step 4: `NewHomeScreen`'deki ilk-çalıştırma geo fallback'ini sil**

`src/screens/home/NewHomeScreen.tsx:64-75` arasındaki `useEffect` bloğunu tamamen SİL (ülkenin tek sahibi artık `LocationProvider`; iki yazar olursa hangisinin kazandığı belirsizleşir). Kullanılmayan `getCountryCode` ve `countryStorage` import'larını da temizle.

- [ ] **Step 5: Doğrulama + commit**

```bash
npx vitest run && npx tsc --noEmit && npx expo lint
git rm src/hooks/useLocationGate.ts
git add App.tsx src/context/LocationContext.tsx src/navigation/RootNavigator.tsx src/screens/home/NewHomeScreen.tsx
git commit -m "feat(mobile): LocationProvider — kapı + GPS + çapa çözümlemesi tek sahipte; ülke kendini günceller"
```

**Not:** `src/utils/locationGate.ts` ve `src/utils/__tests__/locationGate.test.ts` DURUYOR — `runLocationGate()` hâlâ kullanılıyor, yalnızca çağrıldığı yer `RootNavigator`'dan `LocationProvider`'a taşındı. Silinen tek dosya `useLocationGate.ts` hook'udur (AppState mantığı provider'a taşındığı için gereksizleşti). Bu task sonrası 16 mevcut konum testi hâlâ geçmeli.

---

### Task 5: CompareResultsScreen çapayı tüketsin

Merkezî invaryantın tek uygulama noktası.

**Files:**
- Modify: `Cheep-Mobile/src/screens/lists/CompareResultsScreen.tsx:54-96`

**Interfaces:**
- Consumes: `useLocationAnchor()` (Task 4), `shouldFilterByDistance()` (Task 1), `useLocale().country`

- [ ] **Step 1: Kendi GPS çağrısını kaldır, çapayı context'ten oku**

`CompareResultsScreen.tsx` — `getUserLocation` import'unu kaldır, şunları ekle:

```ts
import { useLocationAnchor } from '../../context/LocationContext';
import { shouldFilterByDistance } from '../../utils/anchor';
```

`const [loc, setLoc] = useState<Coords | null | undefined>(undefined);` state'ini ve onu dolduran 54-64 arasındaki `useEffect`'i SİL. Yerine:

```ts
  const { anchor } = useLocationAnchor();
  const { country } = useLocale(); // (useLocale zaten import edilmiş — formatMoney için)

  // MERKEZÎ İNVARYANT: yarıçap filtresi yalnızca çapa koordinatlıysa VE katalogla
  // aynı ülkedeyse gönderilir. Aksi halde userLocation/radiusKm HİÇ gönderilmez →
  // backend filtre uygulamaz → kullanıcı tüm marketleri görür (boş ekran yerine).
  const filterByDistance = anchor ? shouldFilterByDistance(anchor, country) : false;
```

Karşılaştırma efektini (67-96) şuna güncelle — bağımlılık `loc` yerine `anchor` olur:

```ts
  useEffect(() => {
    if (!anchor) return; // çapa çözülene kadar bekle
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await listService.compareList(listId, {
          maxStores: 4,
          includeMissingProducts: true,
          ...(filterByDistance && anchor.coords
            ? { userLocation: anchor.coords, radiusKm }
            : {}),
        });
        if (!alive) return;
        setResults(data);
      } catch (error) {
        if (!alive) return;
        console.error('Compare error:', error);
        Alert.alert(t('common.error'), t('compare.load_error'));
        navigation.goBack();
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, radiusKm, anchor, filterByDistance]);
```

`hasLocation`'ı (113) invaryanta bağla:

```ts
  const hasLocation = filterByDistance;
```

- [ ] **Step 2: Doğrulama + commit**

```bash
npx vitest run && npx tsc --noEmit && npx expo lint
git add src/screens/lists/CompareResultsScreen.tsx
git commit -m "feat(mobile): compare ekranı çapayı tüketir — yarıçap filtresi invaryanta bağlandı"
```

---

### Task 6: Arayüz — konum sayfası, çip, şerit, profil bağlantısı, i18n

**Files:**
- Create: `Cheep-Mobile/src/components/location/LocationSheet.tsx`
- Create: `Cheep-Mobile/src/components/location/CountryChangedBanner.tsx`
- Modify: `Cheep-Mobile/src/screens/home/NewHomeScreen.tsx` (çip + şerit)
- Modify: `Cheep-Mobile/src/screens/profile/ProfileScreen.tsx:195-205` (ülke satırı sheet açsın)
- Modify: `Cheep-Mobile/src/i18n/locales/{tr,en,pl,de,sv}.json`

**Interfaces:**
- Consumes: `useLocationAnchor()` (Task 4), `searchAddress`/`validateCandidate` (Task 3)

- [ ] **Step 1: i18n anahtarlarını 5 dile ekle**

`location` adında YENİ bir üst-düzey ad alanı ekle. Anahtarlar (TR referans; diğer diller aynı anlamı taşımalı, sabit Türkçe bırakma):

```
location.title                  "Konum"
location.mode_auto              "Otomatik — konumumu kullan"
location.mode_pinned            "Sabit adres"
location.chip_pinned            "{{label}} · sabit"
location.address_placeholder    "Adres veya şehir yaz"
location.search                 "Ara"
location.searching              "Aranıyor…"
location.use_this               "Bu adresi kullan"
location.back_to_auto           "Otomatiğe dön"
location.not_found              "Adres bulunamadı."
location.unsupported_country    "Cheep henüz bu ülkede yok."
location.no_branches            "Bu adresin yakınında market bulamadık. Yine de devam edebilirsin, ama mesafeler ve rotalar gösterilmez."
location.geocoder_unavailable   "Bu cihazda adres arama çalışmıyor."
location.distances_off          "Mesafeler kapalı"
location.country_changed        "{{country}} konumundasın — {{country}} marketlerine geçildi."
location.dismiss                "Tamam"
```

Ekleme yöntemi: JSON'u `JSON.stringify` ile yeniden yazma (satır-içi nesneleri açar, devasa diff üretir). Bunun yerine metinsel ekleme yap — `docs/superpowers/pilots/` altındaki önceki dil betikleri (`add-gate-keys.mjs` deseni) referans alınabilir: bir çapa satırı bulup ardına ekle, sonra `JSON.parse` ile doğrula.

- [ ] **Step 2: `CountryChangedBanner` yaz**

`src/components/location/CountryChangedBanner.tsx`:

```tsx
/**
 * Otomatik ülke geçişi şeridi. Engellemez, onay sormaz — yalnızca haber verir.
 * (Onay sormuyoruz: GPS Polonya diyorsa kullanıcı gerçekten Polonya'da.)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationAnchor } from '../../context/LocationContext';
import { colors, spacing, typography, borderRadius } from '../../theme';

export function CountryChangedBanner() {
  const { t } = useTranslation();
  const { countryChangedTo, dismissCountryNotice } = useLocationAnchor();
  if (!countryChangedTo) return null;

  const country = t(`countries.${countryChangedTo}`);
  return (
    <View style={styles.bar}>
      <MaterialIcons name="public" size={18} color={colors.primary.main} />
      <Text style={styles.text}>{t('location.country_changed', { country })}</Text>
      <TouchableOpacity onPress={dismissCountryNotice} hitSlop={8}>
        <Text style={styles.action}>{t('location.dismiss')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.light ?? '#E8F5EE',
  },
  text: { flex: 1, ...typography.caption, color: colors.text.primary },
  action: { ...typography.caption, fontWeight: '700', color: colors.primary.main },
});
```

**Not:** `colors.primary.light` yoksa `src/theme` içindeki gerçek anahtarı kullan — uydurma. Temayı açıp doğrula.

- [ ] **Step 3: `LocationSheet` yaz**

`src/components/location/LocationSheet.tsx` — bir `Modal`. Davranış:

1. İki mod düğmesi: **Otomatik** / **Sabit adres**. Mevcut mod `anchor.mode`'dan okunur.
2. **Otomatik** seçilirse → `unpin()` çağır, modalı kapat.
3. **Sabit adres** seçilirse → `TextInput` + "Ara" düğmesi → `searchAddress(query)`:
   - `available === false` → `t('location.geocoder_unavailable')` göster, aday listesi gösterme.
   - `candidates.length === 0` → `t('location.not_found')`.
   - Aksi halde adayları listele (her biri `candidate.label`). **Kullanıcı birini seçmeden hiçbir şey kaydedilmez.**
4. Aday seçilince → `validateCandidate(c)`:
   - `unsupported_country` → `t('location.unsupported_country')` göster, kaydetme.
   - `no_branches` → `t('location.no_branches')` uyarısını göster + "Devam et" düğmesi; kullanıcı onaylarsa `pin(v.pin)` (koordinatsız).
   - `ok` → doğrudan `pin(v.pin)`, modalı kapat.

Mevcut modal deseni için `ProfileScreen.tsx:493-502` (ülke seçici) referans alınabilir.

- [ ] **Step 4: Ana ekrana çip + şerit ekle**

`NewHomeScreen.tsx` — başlığın altına:

```tsx
<CountryChangedBanner />
```

ve çapa çipi (yalnızca `anchor?.mode === 'pinned'` iken görünür):

```tsx
{anchor?.mode === 'pinned' && (
  <TouchableOpacity style={styles.anchorChip} onPress={() => setLocationSheetOpen(true)}>
    <MaterialIcons name="push-pin" size={14} color={colors.primary.main} />
    <Text style={styles.anchorChipText}>
      {t('location.chip_pinned', { label: anchor.label })}
    </Text>
    {!anchor.coords && (
      <Text style={styles.anchorChipMuted}>· {t('location.distances_off')}</Text>
    )}
  </TouchableOpacity>
)}
```

- [ ] **Step 5: Profil ülke satırını sheet'e bağla**

`ProfileScreen.tsx` — mevcut `handleSelectCountry` (195-205) ve ülke seçici modalını (493-502) KALDIR; ülke satırı artık `LocationSheet` açsın. Alt yazısı çapayı yansıtsın:
- `anchor?.mode === 'pinned'` → `t('location.chip_pinned', { label: anchor.label })`
- aksi halde → `t('countries.' + country)`

Ülke değişimi artık `LocationProvider` üzerinden olur (o da `setCountry` + `userService.updatePreferences` çağırır), yani `ProfileScreen`'deki eski çağrılar tekrarlanmamalı.

- [ ] **Step 6: Doğrulama + commit**

```bash
npx vitest run && npx tsc --noEmit && npx expo lint
node -e "['tr','en','pl','de','sv'].forEach(l=>{const j=require('./src/i18n/locales/'+l+'.json');['title','mode_auto','chip_pinned','no_branches','country_changed'].forEach(k=>{if(!j.location?.[k])throw new Error(l+': location.'+k+' eksik')})});console.log('i18n ok')"
git add src/components/location src/screens/home/NewHomeScreen.tsx src/screens/profile/ProfileScreen.tsx src/i18n/locales
git commit -m "feat(mobile): konum sayfası, çapa çipi ve ülke-değişti şeridi (5 dil)"
```

---

### Task 7: Uçtan uca doğrulama ve sürüm

Otomatik testler saf mantığı kapsar; UI ve gerçek GPS davranışı **manuel** doğrulanmalı. Aşağıdaki senaryoların hepsi geçmeden sürüm çıkarma.

**Files:**
- Modify: `Cheep-Mobile/app.json` (version, android.versionCode)
- Modify: `Cheep-Mobile/android/app/build.gradle` (versionName, versionCode)

- [ ] **Step 1: Tam otomatik doğrulama**

```bash
npx vitest run && npx tsc --noEmit && npx expo lint
```
Expected: tüm testler PASS, 0 tip hatası, 0 lint hatası.

- [ ] **Step 2: Manuel senaryolar (emülatörde konum sahtelemesiyle)**

Android emülatöründe konum: *Extended controls → Location → koordinat gir → Send*.

1. **Seyahat:** Konumu İzmir yap, uygulamayı aç → TR marketleri. Uygulamayı arka plana al, konumu Varşova yap, öne getir → şerit çıkmalı ("Polonya konumundasın…"), ülke PL olmalı, marketler PL olmalı.
2. **Desteklenmeyen ülke:** Konumu Berlin yap → ülke DEĞİŞMEMELİ (son ülke korunur), compare ekranında mesafe filtresi kapalı olmalı (tüm marketler listelenir, "yakında market yok" ÇIKMAMALI).
3. **Sabitleme:** İzmir'deyken konum sayfasından "Sabit adres" → "Marszałkowska, Warszawa" ara → adayı seç → PL kataloğu + gerçek Varşova mesafeleri. Uygulamayı kapat/aç → pin KORUNMALI (GPS İzmir olsa bile).
4. **Otomatiğe dönüş:** Çipe dokun → "Otomatiğe dön" → tekrar TR + GPS mesafeleri.
5. **Şubesiz adres:** Polonya'da market olmayan ıssız bir koordinat ara → "yakınında market bulamadık" uyarısı → devam et → PL kataloğu görünür, mesafeler KAPALI, boş ekran YOK.
6. **İzin reddi:** Konum iznini sistemden kapat, uygulamayı öne getir → kapı çıkar; reddet → uygulama çalışmaya devam eder, tüm marketler mesafesiz listelenir.
7. **Dil:** Cihaz dilini Lehçe yap → konum sayfası, şerit ve tüm uyarılar Lehçe olmalı (Türkçe sızıntı YOK).

- [ ] **Step 3: Sürümü yükselt**

`app.json`: `"version": "1.2.0"`, `"android": { "versionCode": 13 }`
`android/app/build.gradle`: `versionCode 13`, `versionName "1.2.0"`

(İkisi de elle güncellenir: `android/` gitignore'da, ama build ondan okur; `app.json` ise prebuild'in kaynağıdır. Hizasız kalırlarsa bir sonraki prebuild versionCode'u geri düşürür.)

- [ ] **Step 4: Commit + build**

```bash
git add app.json && git commit -m "chore(mobile): release 1.2.0 (versionCode 13) — alışveriş çapası"
git push origin main

export JAVA_HOME="/c/Program Files/Java/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"
cd android && ./gradlew bundleRelease --no-daemon
cp app/build/outputs/bundle/release/app-release.aab ~/Desktop/cheep-1.2.0-vc13.aab
```

**Not:** Build Git Bash'ten çalıştırılmalı (node PATH'te olmalı); `cmd` çalışmaz.

---

## Self-Review

**Spec kapsamı:** Model → Task 1. Otomatik mod + ülke geçişi → Task 4. Sabitlenmiş mod + üç kapı → Task 3 (mantık) + Task 6 (arayüz). Merkezî invaryant → Task 1 (kural) + Task 5 (uygulama). Hata tablosu → Task 1 (GPS yok / desteklenmeyen ülke), Task 3 (geocoder yok / şube yok), mevcut `geo.ts` (rıza yok / TTL). Backend değişikliği yok → doğrulandı. Test listesi → Task 1, 3 (otomatik) + Task 7 (manuel).

**Tip tutarlılığı:** `PinnedAnchor` Task 1'de tanımlanır, Task 3'te üretilir, Task 4'te tüketilir — aynı alanlar (`coords`, `countryCode`, `label`). `shouldFilterByDistance(anchor, catalogCountry)` Task 1'de tanımlanır, yalnızca Task 5'te çağrılır. `searchAddress` `SearchResult` döner (`available` + `candidates`), Task 6 ikisini de ayrı ayrı işler.

**Bilinen sınır:** vitest RN bileşenlerini render edemez; `LocationSheet`, çip ve şerit yalnızca Task 7'deki manuel senaryolarla doğrulanır. Bu, mevcut test altyapısının kabul edilmiş sınırıdır — plan bunu gizlemek yerine açıkça listeler.
