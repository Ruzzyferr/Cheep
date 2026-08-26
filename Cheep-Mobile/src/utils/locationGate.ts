/**
 * 📍 Konum kapısı — uygulama her açıldığında konumun gerçekten ÇALIŞIR durumda
 * olduğunu teyit eder; değilse önce NEDEN gerektiğini anlatır, sonra Android'in
 * kendi izin modalını çıkarır.
 *
 * İki ayrı durum var ve ikisi de "açık" olmalı:
 *   1) KVKK açık rızası  (uygulama içi, cihazda saklanır)
 *   2) OS konum izni     (Android/iOS sistem izni — kullanıcı ayarlardan kaldırabilir,
 *                         Android kullanılmayan uygulamalarda kendisi de geri alabilir)
 * Biri eksikse konum özellikleri sessizce çalışmaz. Kapı bu sapmayı yakalar.
 */
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import i18n from '../i18n';
import { getLocationConsent, promptLocationConsent } from './consent';
import { locationPromptStorage } from './storage';
import { appAlert } from './dialog';

/** "Şimdi değil" — kullanıcı istemi geri çevirdi; bir hafta sorma. */
const SNOOZE_DISMISSED_MS = 7 * 24 * 60 * 60 * 1000;
/** Sistem modalı gösterildi ve reddedildi — 3 gün sorma. */
const SNOOZE_OS_DENIED_MS = 3 * 24 * 60 * 60 * 1000;
/** İzin kalıcı reddedilmiş (sistem modalı bir daha çıkmaz) — 14 gün sorma. */
const SNOOZE_OS_BLOCKED_MS = 14 * 24 * 60 * 60 * 1000;

export type LocationReadyReason =
  | 'ready'
  | 'consent_declined'
  | 'dismissed'
  | 'os_denied'
  | 'os_blocked'
  | 'error';

export interface LocationStatus {
  /** KVKK açık rızası verildi mi? */
  consented: boolean;
  /** OS konum izni verildi mi? */
  osGranted: boolean;
  /** Sistem modalı hâlâ gösterilebilir mi? (false → yalnızca Ayarlar'dan açılır) */
  canAskOs: boolean;
  /** Konum fiilen kullanılabilir mi? (ikisi de açık) */
  ready: boolean;
}

/** Mevcut durumu SORMADAN okur — her açılışta yapılan "teyit" budur. */
export async function getLocationStatus(): Promise<LocationStatus> {
  const consented = (await getLocationConsent()) === 'granted';
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    const osGranted = perm.status === 'granted';
    return { consented, osGranted, canAskOs: perm.canAskAgain, ready: consented && osGranted };
  } catch {
    return { consented, osGranted: false, canAskOs: false, ready: false };
  }
}

/** Alert'i Promise'e çeviren yardımcı (onay/iptal). */
function confirm(title: string, message: string, confirmText: string, cancelText: string) {
  return new Promise<boolean>((resolve) => {
    appAlert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Konumu kullanılabilir hâle getirmeye çalışır. Sırasıyla:
 *   1) KVKK rızası yoksa açık-rıza istemini göster (reddederse dur).
 *   2) OS izni yoksa ve sistem modalı çıkabiliyorsa: NEDEN gerektiğini anlat,
 *      sonra Android'in izin modalını çıkar.
 *   3) İzin kalıcı reddedilmişse (canAskAgain=false) sistem modalı bir daha ÇIKMAZ —
 *      kullanıcıyı uygulama ayarlarına yönlendir.
 *
 * Not: rıza istemi zaten neden gerektiğini anlatıyor; hemen ardından ikinci bir
 * açıklama göstermeyiz (üst üste 3 diyalog olurdu) — doğrudan sistem modalına geçilir.
 */
export async function ensureLocationReady(): Promise<LocationReadyReason> {
  const t = i18n.t.bind(i18n);
  try {
    let justConsented = false;
    if ((await getLocationConsent()) !== 'granted') {
      const ok = await promptLocationConsent(); // KVKK açık-rıza istemi (5 dilde)
      if (!ok) {
        await locationPromptStorage.snooze(SNOOZE_DISMISSED_MS);
        return 'consent_declined';
      }
      justConsented = true;
    }

    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status === 'granted') {
      await locationPromptStorage.clear();
      return 'ready';
    }

    // `status === 'undetermined'` KONTROLÜ ŞART — bu satır olmadan HİÇBİR YENİ
    // KULLANICI konum izni veremiyordu.
    //
    // expo-modules-core Android'de `canAskAgain`i doğrudan
    // `shouldShowRequestPermissionRationale()`den türetiyor. Android'de o
    // fonksiyon İKİ ayrı durumda `false` döner:
    //   1) izin KALICI reddedildi ("bir daha sorma")
    //   2) izin HİÇ İSTENMEDİ (temiz kurulum)
    // Yani temiz kurulumda `canAskAgain` false geliyordu ve buradaki kapı onu
    // "kalıcı engellenmiş" sanıp kullanıcıyı Ayarlar'a yolluyordu; sistem izin
    // modalı HİÇ gösterilmiyordu. Kullanıcı Ayarlar'da ne yapacağını bilmiyor,
    // izin hiç verilmiyordu.
    //
    // İki durumu ayıran sinyal `status`: expo `didAsk` bayrağını kendi
    // SharedPreferences'ında tutuyor ve hiç sorulmamışsa `undetermined`,
    // sorulup reddedilmişse `denied` döndürüyor. Dolayısıyla Ayarlar dalı
    // yalnızca GERÇEKTEN sorulmuş VE artık sorulamaz olan izin için geçerli.
    if (perm.status !== 'undetermined' && !perm.canAskAgain) {
      // Sistem modalı bir daha gösterilemez → tek yol uygulama ayarları.
      const go = await confirm(
        t('profile.location_os_blocked_title'),
        t('profile.location_os_blocked_body'),
        t('profile.open_settings'),
        t('common.cancel'),
      );
      await locationPromptStorage.snooze(SNOOZE_OS_BLOCKED_MS);
      if (go) await Linking.openSettings();
      return 'os_blocked';
    }

    if (!justConsented) {
      // Rıza zaten vardı ama cihaz izni kapalı → önce nedenini anlat.
      const proceed = await confirm(
        t('consent.gate_title'),
        t('consent.gate_message'),
        t('consent.gate_allow'),
        t('consent.gate_later'),
      );
      if (!proceed) {
        await locationPromptStorage.snooze(SNOOZE_DISMISSED_MS);
        return 'dismissed';
      }
    }

    // Android/iOS'un kendi izin modalı.
    perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status === 'granted') {
      await locationPromptStorage.clear();
      return 'ready';
    }

    await locationPromptStorage.snooze(
      perm.canAskAgain ? SNOOZE_OS_DENIED_MS : SNOOZE_OS_BLOCKED_MS,
    );
    return perm.canAskAgain ? 'os_denied' : 'os_blocked';
  } catch {
    return 'error';
  }
}

/**
 * Açılış kapısı: durumu teyit eder, gerekiyorsa istemi başlatır.
 * Konum zaten çalışıyorsa HİÇBİR ŞEY göstermez. Kullanıcı yakın zamanda
 * "şimdi değil" dediyse (snooze) sessiz kalır — her açılışta diyalog yağmuru olmaz.
 */
export async function runLocationGate(): Promise<LocationReadyReason | 'skipped'> {
  const status = await getLocationStatus();
  if (status.ready) {
    await locationPromptStorage.clear();
    return 'ready';
  }
  if (await locationPromptStorage.isSnoozed()) return 'skipped';
  return ensureLocationReady();
}
