/**
 * Konum alt sistemi — regresyon testleri.
 *
 * Senaryo (canlı hata): kullanıcı Bergama'da kurdu, rıza verdi, marketleri gördü.
 * Sonra Çiğli'ye gitti → "yakında market yok" + profilde konum "Kapalı".
 * Kök neden: rıza kapalıyken/izin yokken getUserLocation() null yerine CACHE'teki
 * eski koordinata düşüyordu; o eski nokta "geçerli konum" sayılıp yarıçap filtresi
 * Bergama etrafına uygulanıyordu. Üstelik rıza geri açılamıyordu (tek yönlü kapı).
 */
/* eslint-disable import/first --
 * vi.mock fabrikaları aşağıdaki mem/gps/alertAnswer sabitlerine kapanır; test
 * edilen modüller bu sabitler tanımlandıktan SONRA import edilmeli, aksi halde
 * fabrika TDZ'de patlar. Bu yüzden importlar bilinçli olarak dosya ortasında.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Test doubles ────────────────────────────────────────────────────────────
const mem = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  setItemAsync: async (k: string, v: string) => void mem.set(k, v),
  getItemAsync: async (k: string) => mem.get(k) ?? null,
  deleteItemAsync: async (k: string) => void mem.delete(k),
}));

const gps = {
  permission: 'granted' as 'granted' | 'denied',
  position: null as { latitude: number; longitude: number } | null,
  throws: false,
};
vi.mock('expo-location', () => ({
  Accuracy: { Low: 1, Balanced: 3 },
  // vi.fn() OLARAK tanımlı: getUserLocation()'ın bunu HİÇ ÇAĞIRMADIĞINI
  // (yalnızca pasif getForegroundPermissionsAsync'i kullandığını) doğrulayan
  // testin gözetleyicisi budur — ikinci bir OS izin modalı riskini kilitler.
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: gps.permission })),
  getForegroundPermissionsAsync: async () => ({
    status: gps.permission,
    canAskAgain: true,
  }),
  getCurrentPositionAsync: async () => {
    if (gps.throws || !gps.position) throw new Error('Location services disabled');
    return { coords: gps.position };
  },
  reverseGeocodeAsync: async () => [{ isoCountryCode: 'TR' }],
}));

// KVKK istemi: testte kullanıcının vereceği cevabı biz belirliyoruz.
// Uygulama artık işletim sisteminin uyarı kutusunu değil kendi DialogHost'unu
// kullanıyor; bu yüzden testte de gerçek yolu — diyalog köprüsünü — bağlıyoruz.
const alertAnswer = { accept: true, shown: 0 };
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

vi.mock('../../i18n', () => ({ default: { t: (k: string) => k } }));

const BERGAMA = { latitude: 39.1206, longitude: 27.1806 };
const CIGLI = { latitude: 38.4949, longitude: 26.9819 };

import * as Location from 'expo-location';
import { getUserLocation } from '../geo';
import {
  ensureLocationConsent,
  promptLocationConsent,
  revokeLocationConsent,
  getLocationConsent,
} from '../consent';
import { locationStorage } from '../storage';
import { registerDialogHandler } from '../dialog';

// Diyalog köprüsüne test cevabını bağla: kullanıcı kabul mü ediyor, ret mi.
registerDialogHandler((o) => {
  alertAnswer.shown++;
  const buttons = o.buttons ?? [];
  // buttons: [reddet, kabul]
  const btn = alertAnswer.accept ? buttons[1] : buttons[0];
  void btn?.onPress?.();
});

beforeEach(() => {
  mem.clear();
  gps.permission = 'granted';
  gps.position = BERGAMA;
  gps.throws = false;
  alertAnswer.accept = true;
  alertAnswer.shown = 0;
  vi.useRealTimers();
  vi.mocked(Location.requestForegroundPermissionsAsync).mockClear();
});

/** Bergama'da ilk kurulum: rıza verildi, konum alındı ve cache'lendi. */
async function installInBergama() {
  await ensureLocationConsent();
  const loc = await getUserLocation();
  expect(loc).toEqual({ lat: BERGAMA.latitude, lon: BERGAMA.longitude });
}

describe('rıza kapalıyken konum', () => {
  it('rıza geri alınınca eski koordinat SİLİNİR ve konum null döner', async () => {
    await installInBergama();

    // Kullanıcı profilden KVKK rızasını kapatıyor.
    await revokeLocationConsent();

    // Çiğli'ye gidiyor, uygulamayı açıyor.
    gps.position = CIGLI;
    const loc = await getUserLocation();

    // Rıza yok → konum HİÇ işlenmemeli. Eski Bergama noktası dönmemeli.
    expect(loc).toBeNull();
    // Cache de temizlenmiş olmalı (KVKK: rıza geri alınınca veri kalmaz).
    expect(await locationStorage.getLocation()).toBeNull();
  });

  it('OS izni yoksa eski koordinata düşmez ve cache SİLİNİR', async () => {
    await installInBergama();

    gps.permission = 'denied'; // kullanıcı sistem ayarlarından izni kaldırdı
    gps.position = CIGLI;

    expect(await getUserLocation()).toBeNull();
    // İzni kalkmış bir uygulamada hayalet koordinat KALMAMALI — aksi halde
    // izin kapalıyken bile eski nokta sunucuya gitmeye devam ederdi.
    expect(await locationStorage.getLocation()).toBeNull();
  });
});

describe('getUserLocation() asla OS izni İSTEMEZ (yalnızca kapı sorar)', () => {
  it('izin verilmişken bile requestForegroundPermissionsAsync HİÇ çağrılmaz', async () => {
    await installInBergama();

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('izin reddedilmişken de requestForegroundPermissionsAsync ÇAĞRILMAZ (ikinci modal riski yok)', async () => {
    await ensureLocationConsent();
    gps.permission = 'denied'; // kapı zaten sordu ve reddedildi (os_denied)

    const loc = await getUserLocation();

    expect(loc).toBeNull();
    // KİLİT NOKTA: burası ikinci bir sistem modalı AÇMAYA teşebbüs bile etmez —
    // yalnızca pasif getForegroundPermissionsAsync okunur.
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('KVKK rıza geçişi (profil)', () => {
  it('reddedilmiş rıza, kullanıcı açıkça isterse yeniden AÇILABİLİR', async () => {
    await ensureLocationConsent(); // granted
    await revokeLocationConsent(); // denied
    expect(await getLocationConsent()).toBe('denied');

    // Profildeki satıra basmak = açık kullanıcı talebi → istem TEKRAR gösterilmeli.
    alertAnswer.accept = true;
    alertAnswer.shown = 0;
    const ok = await promptLocationConsent();

    expect(alertAnswer.shown).toBe(1); // istem gerçekten gösterildi
    expect(ok).toBe(true);
    expect(await getLocationConsent()).toBe('granted');
  });

  it('pasif çağrılar (ensureLocationConsent) reddedilmiş kullanıcıyı RAHATSIZ ETMEZ', async () => {
    await ensureLocationConsent();
    await revokeLocationConsent();

    alertAnswer.shown = 0;
    const ok = await ensureLocationConsent();

    expect(ok).toBe(false);
    expect(alertAnswer.shown).toBe(0); // sticky-denied korunuyor
  });
});

describe('konum tazeliği (TTL)', () => {
  it('GPS geçici hata verirse TAZE cache fallback olarak kullanılır', async () => {
    await installInBergama();

    gps.throws = true; // anlık GPS hatası (kapalı mekân vs.)
    const loc = await getUserLocation();

    expect(loc).toEqual({ lat: BERGAMA.latitude, lon: BERGAMA.longitude });
  });

  it('BAYAT cache (TTL aşımı) asla geçerli konum sayılmaz', async () => {
    await installInBergama(); // Bergama koordinatı şimdi cache'te

    // Kullanıcı ertesi gün Çiğli'de; GPS hata veriyor (konum servisleri kapalı).
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
    gps.throws = true;

    // 24 saatlik Bergama noktası "şu anki konumum" olarak KULLANILMAMALI —
    // aksi halde yarıçap filtresi Bergama'ya uygulanır ve kullanıcı Çiğli'de
    // "yakında market yok" görür. null → filtre yok → tüm marketler listelenir.
    expect(await getUserLocation()).toBeNull();
  });

  it('zaman damgasız (eski sürümden kalma) cache bayat sayılır', async () => {
    // v1.1.0 formatı: sadece {lat, lon}
    const { storage, STORAGE_KEYS } = await import('../storage');
    await storage.setItem(
      STORAGE_KEYS.USER_LOCATION,
      JSON.stringify({ lat: BERGAMA.latitude, lon: BERGAMA.longitude }),
    );
    await ensureLocationConsent();
    gps.throws = true;

    expect(await getUserLocation()).toBeNull();
  });
});
