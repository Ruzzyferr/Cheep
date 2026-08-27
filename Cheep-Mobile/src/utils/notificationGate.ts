/**
 * 🔔 Bildirim kapısı — konum kapısının (locationGate.ts) kardeşi.
 *
 * Açılışta, KONUM KAPISI ÇÖZÜMLENDİKTEN SONRA çalışır (ardışık, eşzamanlı
 * değil): üst üste iki sistem modalı çıkmasın.
 *
 * Sistem modalından önce ne için kullanıldığını anlatan TEK DÜĞMELİ bir
 * bilgi ekranı gösteririz ("Devam"). Bağlam, izne evet deme oranını belirgin
 * biçimde artırıyor; özellikle Android'de değerli, çünkü izin iki kez
 * reddedilince kalıcı kapanıyor ve bir daha sorulamıyor.
 *
 * DÜĞME TEK VE NÖTR OLMAK ZORUNDA. Eskiden "Haber ver" / "Şimdi değil" vardı
 * ve "Şimdi değil" sistem istemini tamamen atlatıyordu; App Store bunun konum
 * eşdeğerini 27 Ağustos 2026'da reddetti (5.1.1(iv), gönderim bd4defce):
 * izin isteğinin önündeki özel mesaj onay dili taşıyamaz ve kullanıcı mesajı
 * kapatıp istemi atlayamamalı — mesajdan sonra HER ZAMAN sistem istemine
 * geçilmeli. Aynı kural burada da uygulanıyor.
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import i18n from '../i18n';
import { notificationPromptStorage, pushTokenStorage } from './storage';
import { notificationService } from '../services/notification.service';
import { appAlert } from './dialog';

/** Sistem modalı gösterildi ve reddedildi — 3 gün sorma. */
const SNOOZE_OS_DENIED_MS = 3 * 24 * 60 * 60 * 1000;
/** Kalıcı reddedilmiş (sistem modalı bir daha çıkmaz) — 14 gün sorma. */
const SNOOZE_OS_BLOCKED_MS = 14 * 24 * 60 * 60 * 1000;

export type NotificationReadyReason =
  | 'ready'
  | 'os_denied'
  | 'os_blocked'
  | 'unsupported'
  | 'error';

export interface NotificationStatus {
  osGranted: boolean;
  /** Sistem modalı hâlâ gösterilebilir mi? (false → yalnızca Ayarlar'dan) */
  canAskOs: boolean;
  ready: boolean;
}

/** Mevcut durumu SORMADAN okur. */
export async function getNotificationStatus(): Promise<NotificationStatus> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    const osGranted = perm.status === 'granted';
    return { osGranted, canAskOs: perm.canAskAgain ?? true, ready: osGranted };
  } catch {
    return { osGranted: false, canAskOs: false, ready: false };
  }
}

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

/** Tek düğmeli bilgi ekranı: kapatmanın TEK yolu "Devam" — çıkış yok. */
function inform(title: string, message: string) {
  return new Promise<void>((resolve) => {
    appAlert(
      title,
      message,
      [{ text: i18n.t('common.continue'), onPress: () => resolve() }],
      { cancelable: false },
    );
  });
}

/**
 * Cihazın FCM kayıt token'ını alır ve sunucuya kaydeder.
 *
 * Expo'nun push servisi bilerek KULLANILMIYOR: o da sonunda FCM'e gidiyor ama
 * araya ekstra bir hesap ve `projectId` sokuyordu. Firebase zaten kurulu
 * (google-services.json), aracıya gerek yok — `getDevicePushTokenAsync` ham
 * FCM token'ını veriyor ve backend doğrudan FCM v1'e gönderiyor.
 *
 * Emülatör/simülatörde token alınamaz (gerçek cihaz gerekir) — orada sessizce
 * atlanır, uygulama içi bildirimler zaten çalışıyor.
 */
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token || typeof token !== 'string') return null;

    await notificationService.registerPushToken(token, Platform.OS, i18n.language);
    await pushTokenStorage.save(token);
    return token;
  } catch {
    // Token alınamazsa uygulama içi bildirimler etkilenmez; sessiz geç.
    return null;
  }
}

/** Kullanıcı çıkış yaptığında / bildirimleri kapattığında sunucudaki token'ı siler. */
export async function unregisterPushToken(): Promise<void> {
  const token = await pushTokenStorage.get();
  if (!token) return;
  try {
    await notificationService.removePushToken(token);
  } catch {
    // Sunucuya ulaşılamazsa token'ı yerelden yine de düşür.
  }
  await pushTokenStorage.clear();
}

/**
 * İzni ister. Sırasıyla:
 *   1) Zaten verilmişse → token'ı tazele ve çık.
 *   2) Kalıcı reddedilmişse → ayarlara yönlendir.
 *   3) Değilse: tek düğmeli bilgi ekranı, ARDINDAN her hâlükârda sistem modalı.
 */
export async function ensureNotificationsReady(): Promise<NotificationReadyReason> {
  const t = i18n.t.bind(i18n);

  if (!Device.isDevice) return 'unsupported';

  try {
    let perm = await Notifications.getPermissionsAsync();

    if (perm.status === 'granted') {
      await notificationPromptStorage.clear();
      await registerPushToken();
      return 'ready';
    }

    // `status === 'undetermined'` KONTROLÜ ŞART — bkz. locationGate'teki uzun
    // gerekçe. Android'de `canAskAgain`, izin HİÇ İSTENMEMİŞKEN de `false`
    // geliyor; bu satır olmadan temiz kurulumdaki kullanıcı sistem izin
    // modalını hiç görmeden Ayarlar'a yollanıyordu. Android 13+ bildirimi
    // çalışma zamanı izni yaptığı için bu, yeni cihazlarda push'un hiç
    // açılamaması demekti.
    if (perm.status !== 'undetermined' && !perm.canAskAgain) {
      const go = await confirm(
        t('notifications.os_blocked_title'),
        t('notifications.os_blocked_body'),
        t('profile.open_settings'),
        t('common.cancel'),
      );
      await notificationPromptStorage.snooze(SNOOZE_OS_BLOCKED_MS);
      if (go) await Linking.openSettings();
      return 'os_blocked';
    }

    // Bağlam önce, ama ÇIKIŞSIZ: tek düğme ve ardından mutlaka sistem istemi.
    await inform(t('notifications.gate_title'), t('notifications.gate_message'));

    perm = await Notifications.requestPermissionsAsync();
    if (perm.status === 'granted') {
      await notificationPromptStorage.clear();
      await registerPushToken();
      return 'ready';
    }

    await notificationPromptStorage.snooze(
      perm.canAskAgain ? SNOOZE_OS_DENIED_MS : SNOOZE_OS_BLOCKED_MS,
    );
    return perm.canAskAgain ? 'os_denied' : 'os_blocked';
  } catch {
    return 'error';
  }
}

/**
 * Açılış kapısı. İzin zaten varsa hiçbir şey göstermez (yalnızca token'ı
 * tazeler). Kullanıcı yakın zamanda "şimdi değil" dediyse sessiz kalır.
 */
export async function runNotificationGate(): Promise<NotificationReadyReason | 'skipped'> {
  const status = await getNotificationStatus();
  if (status.ready) {
    await notificationPromptStorage.clear();
    await registerPushToken();
    return 'ready';
  }
  if (await notificationPromptStorage.isSnoozed()) return 'skipped';
  return ensureNotificationsReady();
}
