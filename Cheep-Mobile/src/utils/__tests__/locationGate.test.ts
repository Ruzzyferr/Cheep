/**
 * Konum kapısı — uygulama her açıldığında konumun çalıştığını teyit eder,
 * kapalıysa SİSTEM izin modalını çıkarır ve izin alınırsa KVKK açık rızasını sorar.
 *
 * Buradaki testler iki şeyi kilitler:
 *   1) SIRA (App Store 5.1.1(iv)): sistem isteminin ÖNÜNDE, kullanıcının
 *      kapatıp istemi atlayabileceği hiçbir uygulama-içi diyalog OLMAMALI.
 *   2) Kapının SESSİZ KALMASI gereken durumlar: konum zaten çalışıyorsa,
 *      kullanıcı yakında reddettiyse (snooze) ya da izin kalıcı reddedilmişse
 *      diyalog yağmuru olmamalı.
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
  status: 'denied' as 'granted' | 'denied' | 'undetermined',
  canAskAgain: true,
  requestCalls: 0,
  /** Sistem modalı çağrılınca kullanıcının vereceği cevap. */
  onRequest: { status: 'granted' as 'granted' | 'denied' | 'undetermined', canAskAgain: true },
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

// ─────────────────────────────────────────────────────────────────────────────
// SIRA: SİSTEM İSTEMİ ÖNCE, KVKK RIZASI SONRA (App Store 5.1.1(iv)).
//
// 27 Ağustos 2026'da App Review tam tersi sırayı reddetti: sistem isteminin
// önünde "Evet, açık rıza veriyorum" / "Hayır, teşekkürler" düğmeli kendi
// diyaloğumuz vardı ve "Hayır" istemi tamamen atlatıyordu. Aşağıdaki testler o
// sırayı geri gelemeyecek biçimde kilitliyor.
// ─────────────────────────────────────────────────────────────────────────────

describe('rıza yokken (ilk kez)', () => {
  it('sistem modalını ÖNCE çıkarır; rıza istemi ANCAK izin alınınca gelir', async () => {
    ui.accept = true;

    expect(await runLocationGate()).toBe('ready');

    // Sistem isteminden ÖNCE hiçbir uygulama-içi diyalog yok: gösterilen tek
    // diyalog KVKK istemi ve o da izin ALINDIKTAN SONRA çıkıyor.
    expect(ui.dialogs).toEqual(['consent.location_title']);
    expect(gps.requestCalls).toBe(1);
    expect(await getLocationConsent()).toBe('granted');
  });

  it('sistem modalı reddedilirse KVKK istemi HİÇ gösterilmez', async () => {
    // Rıza, işlenecek veri olmadığında sorulmaz — izin yoksa konum okunamaz.
    ui.accept = true;
    gps.onRequest = { status: 'denied', canAskAgain: true };

    expect(await runLocationGate()).toBe('os_denied');
    expect(ui.dialogs).toEqual([]);
    expect(await getLocationConsent()).toBe(null);
  });

  it('izin alınıp KVKK reddedilirse konum işlenmez ve bir süre sorulmaz', async () => {
    ui.accept = false;

    expect(await runLocationGate()).toBe('consent_declined');
    expect(gps.requestCalls).toBe(1); // izin istendi
    expect(ui.dialogs).toEqual(['consent.location_title']);
    expect(await getLocationConsent()).toBe('denied');
    expect(await locationPromptStorage.isSnoozed()).toBe(true);

    // Sonraki açılış: sessiz.
    ui.dialogs = [];
    expect(await runLocationGate()).toBe('skipped');
    expect(ui.dialogs).toEqual([]);
  });
});

describe('rıza var ama cihaz izni kapalı', () => {
  it('araya açıklama diyaloğu KOYMADAN doğrudan sistem modalını çıkarır', async () => {
    await setLocationConsent('granted');
    ui.accept = true;

    expect(await runLocationGate()).toBe('ready');

    expect(ui.dialogs).toEqual([]); // ASIL SINAV: hiçbir ön diyalog yok
    expect(gps.requestCalls).toBe(1);
  });

  it('erteleme süresi dolunca tekrar sorar', async () => {
    await setLocationConsent('granted');
    ui.accept = true;
    gps.onRequest = { status: 'denied', canAskAgain: true };
    await runLocationGate(); // 3 gün ertelendi

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 4 * 24 * 60 * 60 * 1000);

    gps.onRequest = { status: 'granted', canAskAgain: true };
    gps.requestCalls = 0;
    expect(await runLocationGate()).toBe('ready');
    expect(gps.requestCalls).toBe(1);
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


// ─────────────────────────────────────────────────────────────────────────────
// TEMİZ KURULUM (2026-08-26) — kullanıcı bildirdi: "modal çıkıyor, evet deyince
// beni ayarlara yolluyor".
//
// expo-modules-core Android'de `canAskAgain`i doğrudan
// `shouldShowRequestPermissionRationale()`den türetiyor ve o fonksiyon izin HİÇ
// İSTENMEMİŞKEN de `false` döner. Kapı bunu "kalıcı engellenmiş" sanıp
// Ayarlar'a yolluyordu; yani HİÇBİR YENİ KULLANICI izin veremiyordu.
//
// Bu testler o durumu sabitliyor. Eski mock `status`u yalnızca
// 'granted' | 'denied' alabildiği için hata testlerden kaçmıştı — asıl ders bu.
// ─────────────────────────────────────────────────────────────────────────────

describe('temiz kurulum: izin hiç istenmemiş (undetermined + canAskAgain=false)', () => {
  it('SİSTEM MODALINI çıkarır, Ayarlara YOLLAMAZ', async () => {
    await setLocationConsent('granted');
    gps.status = 'undetermined';
    gps.canAskAgain = false; // Android: hiç sorulmamışken de false
    ui.accept = true;

    expect(await runLocationGate()).toBe('ready');
    expect(gps.requestCalls).toBe(1);   // ASIL SINAV
    expect(ui.settingsOpened).toBe(0);  // Ayarlar'a gitmemeli
  });

  it('rıza da yokken: sistem modalı + ARDINDAN KVKK istemi, Ayarlar yok', async () => {
    gps.status = 'undetermined';
    gps.canAskAgain = false;
    ui.accept = true;

    expect(await runLocationGate()).toBe('ready');
    expect(ui.dialogs).toEqual(['consent.location_title']);
    expect(gps.requestCalls).toBe(1);
    expect(ui.settingsOpened).toBe(0);
  });

  it('GERÇEK kalıcı ret (denied + canAskAgain=false) hâlâ Ayarlara yollar', async () => {
    // Ayrım korunmalı: sorulmuş VE artık sorulamıyorsa tek yol Ayarlar.
    await setLocationConsent('granted');
    gps.status = 'denied';
    gps.canAskAgain = false;
    ui.accept = true;

    expect(await runLocationGate()).toBe('os_blocked');
    expect(gps.requestCalls).toBe(0);
    expect(ui.settingsOpened).toBe(1);
  });
});
