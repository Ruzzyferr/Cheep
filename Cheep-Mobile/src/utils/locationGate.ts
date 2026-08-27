/**
 * 📍 Konum kapısı — uygulama her açıldığında konumun gerçekten ÇALIŞIR durumda
 * olduğunu teyit eder; değilse sistemin kendi izin modalını çıkarır ve izin
 * alınırsa KVKK açık rızasını sorar.
 *
 * İki ayrı durum var ve ikisi de "açık" olmalı:
 *   1) OS konum izni     (Android/iOS sistem izni — kullanıcı ayarlardan kaldırabilir,
 *                         Android kullanılmayan uygulamalarda kendisi de geri alabilir)
 *   2) KVKK açık rızası  (uygulama içi, cihazda saklanır; İZİNDEN SONRA sorulur)
 * Biri eksikse konum özellikleri sessizce çalışmaz. Kapı bu sapmayı yakalar.
 *
 * Sistem izin isteminin ÖNÜNE kendi diyaloğumuzu koymuyoruz — App Store
 * 5.1.1(iv). Ayrıntı `ensureLocationReady` başlığında.
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
 *   1) OS izni yoksa ve sistem modalı çıkabiliyorsa: DOĞRUDAN sistem modalını çıkar.
 *   2) İzin kalıcı reddedilmişse (canAskAgain=false) sistem modalı bir daha ÇIKMAZ —
 *      kullanıcıyı uygulama ayarlarına yönlendir.
 *   3) OS izni alındıysa KVKK açık rızasını sor (reddederse konum İŞLENMEZ).
 *
 * SIRA APPLE 5.1.1(iv) GEREĞİ BÖYLE — ÖNCE OS İZNİ, SONRA KVKK RIZASI.
 * Önceden tam tersiydi: sistem isteminden ÖNCE "Evet, açık rıza veriyorum" /
 * "Hayır, teşekkürler" düğmeli kendi diyaloğumuz çıkıyordu. App Review bunu
 * 27 Ağustos 2026'da reddetti (gönderim bd4defce): izin isteğinin önüne konan
 * özel mesajda (a) düğme metni onay dili taşıyamaz, (b) kullanıcı mesajı
 * kapatıp sistem istemini ATLAYAMAMALI — mesajdan sonra HER ZAMAN sistem
 * istemine geçilmeli.
 *
 * KVKK açısından sıra sorun değil: 6698 m.5 açık rızayı verinin İŞLENMESİ için
 * arar, izin bayrağının varlığı için değil. Sistem izni alınmış olsa bile rıza
 * yokken tek bir koordinat okunmaz/saklanmaz/gönderilmez (bkz. geo.ts) —
 * yani "işleme" hâlâ yalnızca açık rızayla başlıyor. Rıza ayrı, opt-in ve
 * iptal edilebilir kalmaya devam ediyor; OS izniyle birleştirilmedi (Kurul
 * 2018/90: rıza başka bir beyanın içine gömülemez).
 */
export async function ensureLocationReady(): Promise<LocationReadyReason> {
  const t = i18n.t.bind(i18n);
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status === 'granted') return finishWithConsent();

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

    // Android/iOS'un kendi izin modalı — ÖNÜNE hiçbir uygulama-içi diyalog
    // konmaz. "Neden gerekiyor" sorusunu sistem isteminin kendi amaç metni
    // yanıtlıyor (NSLocationWhenInUseUsageDescription, üç dilde yazılı).
    perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status === 'granted') return finishWithConsent();

    await locationPromptStorage.snooze(
      perm.canAskAgain ? SNOOZE_OS_DENIED_MS : SNOOZE_OS_BLOCKED_MS,
    );
    return perm.canAskAgain ? 'os_denied' : 'os_blocked';
  } catch {
    return 'error';
  }
}

/**
 * OS izni ALINDIKTAN SONRA çalışır: KVKK açık rızası yoksa ister.
 * Rıza verilmezse konum işlenmez — uygulama yine tam çalışır, kullanıcı
 * şehrini elle seçer ve rızayı istediği an Profil'den açabilir.
 */
async function finishWithConsent(): Promise<LocationReadyReason> {
  if ((await getLocationConsent()) !== 'granted') {
    const ok = await promptLocationConsent(); // KVKK açık-rıza istemi (5 dilde)
    if (!ok) {
      await locationPromptStorage.snooze(SNOOZE_DISMISSED_MS);
      return 'consent_declined';
    }
  }
  await locationPromptStorage.clear();
  return 'ready';
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
