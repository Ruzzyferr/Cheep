/**
 * Konum kapısı — uygulama her açıldığında konumun çalıştığını teyit eder,
 * kapalıysa önce nedenini anlatır, sonra sistem izin modalını çıkarır.
 *
 * Buradaki testler asıl olarak kapının SESSİZ KALMASI gereken durumları kilitler:
 * konum zaten çalışıyorsa, kullanıcı yakında "şimdi değil" dediyse, ya da izin
 * kalıcı reddedilmişse (sistem modalı bir daha çıkmaz) diyalog yağmuru olmamalı.
 */
/* eslint-disable import/first -- vi.mock fabrikaları aşağıdaki sabitlere kapanır. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mem = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  setItemAsync: async (k: string, v: string) => void mem.set(k, v),
  getItemAsync: async (k: string) => mem.get(k) ?? null,
  deleteItemAsync: async (k: string) => void mem.delete(k),
}));

const gps = {
  status: 'denied' as 'granted' | 'denied',
  canAskAgain: true,
  requestCalls: 0,
  /** Sistem modalı çağrılınca kullanıcının vereceği cevap. */
  onRequest: { status: 'granted' as 'granted' | 'denied', canAskAgain: true },
};
vi.mock('expo-location', () => ({
  Accuracy: { Low: 1, Balanced: 3 },
  getForegroundPermissionsAsync: async () => ({
    status: gps.status,
    canAskAgain: gps.canAskAgain,
  }),
  requestForegroundPermissionsAsync: async () => {
    gps.requestCalls++;
    gps.status = gps.onRequest.status;
    gps.canAskAgain = gps.onRequest.canAskAgain;
    return { status: gps.status, canAskAgain: gps.canAskAgain };
  },
  getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 } }),
  reverseGeocodeAsync: async () => [],
}));

/** Gösterilen diyalog başlıkları + kullanıcının hangi butona bastığı. */
const ui = { dialogs: [] as string[], accept: true, settingsOpened: 0 };
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Alert: {
    alert: (title: string, _m: string, buttons: { onPress?: () => void }[]) => {
      ui.dialogs.push(title);
      // Her iki diyalogda da olumlu buton İKİNCİ sırada (reddet/iptal ilk).
      (ui.accept ? buttons[1] : buttons[0]).onPress?.();
    },
  },
  Linking: { openSettings: async () => void ui.settingsOpened++ },
}));

vi.mock('../../i18n', () => ({ default: { t: (k: string) => k } }));

import { runLocationGate, getLocationStatus } from '../locationGate';
import { setLocationConsent, getLocationConsent } from '../consent';
import { locationPromptStorage } from '../storage';

beforeEach(() => {
  mem.clear();
  gps.status = 'denied';
  gps.canAskAgain = true;
  gps.requestCalls = 0;
  gps.onRequest = { status: 'granted', canAskAgain: true };
  ui.dialogs = [];
  ui.accept = true;
  ui.settingsOpened = 0;
  vi.useRealTimers();
});

describe('konum zaten çalışıyorken', () => {
  it('hiçbir diyalog göstermez ve sistem modalını çağırmaz', async () => {
    await setLocationConsent('granted');
    gps.status = 'granted';

    expect(await runLocationGate()).toBe('ready');
    expect(ui.dialogs).toEqual([]);
    expect(gps.requestCalls).toBe(0);
  });
});

describe('rıza yokken (ilk kez)', () => {
  it('KVKK istemini gösterir, kabul edilince DOĞRUDAN sistem modalını çıkarır', async () => {
    ui.accept = true;

    expect(await runLocationGate()).toBe('ready');

    // Tek uygulama-içi diyalog: KVKK istemi. Ardından ikinci bir "açıklama"
    // diyalogu GÖSTERİLMEZ — üst üste üç diyalog olurdu.
    expect(ui.dialogs).toEqual(['consent.location_title']);
    expect(gps.requestCalls).toBe(1); // Android modalı çıktı
    expect(await getLocationConsent()).toBe('granted');
  });

  it('KVKK reddedilirse sistem modalı HİÇ çağrılmaz', async () => {
    ui.accept = false;

    expect(await runLocationGate()).toBe('consent_declined');
    expect(gps.requestCalls).toBe(0);
    expect(await locationPromptStorage.isSnoozed()).toBe(true);
  });
});

describe('rıza var ama cihaz izni kapalı', () => {
  it('önce nedenini anlatır, sonra sistem modalını çıkarır', async () => {
    await setLocationConsent('granted');
    ui.accept = true;

    expect(await runLocationGate()).toBe('ready');

    expect(ui.dialogs).toEqual(['consent.gate_title']); // "en iyi sonuç için..."
    expect(gps.requestCalls).toBe(1);
  });

  it('"Şimdi değil" denirse sistem modalı çıkmaz ve bir süre tekrar sorulmaz', async () => {
    await setLocationConsent('granted');
    ui.accept = false;

    expect(await runLocationGate()).toBe('dismissed');
    expect(gps.requestCalls).toBe(0);

    // Sonraki açılış: sessiz.
    ui.dialogs = [];
    expect(await runLocationGate()).toBe('skipped');
    expect(ui.dialogs).toEqual([]);
  });

  it('erteleme süresi dolunca tekrar sorar', async () => {
    await setLocationConsent('granted');
    ui.accept = false;
    await runLocationGate(); // 7 gün ertelendi

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);

    ui.dialogs = [];
    ui.accept = true;
    expect(await runLocationGate()).toBe('ready');
    expect(ui.dialogs).toEqual(['consent.gate_title']);
  });
});

describe('izin kalıcı reddedilmişse (canAskAgain=false)', () => {
  it('sistem modalını çağırmaz — Ayarlar’a yönlendirir', async () => {
    await setLocationConsent('granted');
    gps.canAskAgain = false; // Android artık modalı göstermez
    ui.accept = true;

    expect(await runLocationGate()).toBe('os_blocked');

    expect(gps.requestCalls).toBe(0); // boşuna çağırmak anlamsız — modal çıkmaz
    expect(ui.dialogs).toEqual(['profile.location_os_blocked_title']);
    expect(ui.settingsOpened).toBe(1);
    expect(await locationPromptStorage.isSnoozed()).toBe(true);
  });
});

describe('sistem modalı reddedilirse', () => {
  it('durum os_denied olur ve erteleme kurulur', async () => {
    await setLocationConsent('granted');
    ui.accept = true;
    gps.onRequest = { status: 'denied', canAskAgain: true };

    expect(await runLocationGate()).toBe('os_denied');
    expect(gps.requestCalls).toBe(1);
    expect(await locationPromptStorage.isSnoozed()).toBe(true);
  });
});

describe('getLocationStatus', () => {
  it('rıza ve OS iznini AYRI AYRI raporlar (sapma görünür olmalı)', async () => {
    await setLocationConsent('granted');
    gps.status = 'denied';

    const s = await getLocationStatus();
    expect(s).toEqual({ consented: true, osGranted: false, canAskOs: true, ready: false });
  });
});
