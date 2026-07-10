/**
 * 🔐 KVKK — Konum açık rıza yönetimi (6698 m.5 / m.10; Kurul 2018/90).
 *
 * OS'un konum izni ≠ KVKK açık rızası. Bu yüzden cihaz konumu işlenmeden ÖNCE,
 * aydınlatmadan AYRI, opt-in (varsayılan kapalı), hizmet şartına bağlanmamış ve
 * iptal edilebilir bir açık rıza alınır. Rıza cihazda saklanır.
 */
import { Alert } from 'react-native';
import i18n from '../i18n';
import { consentStorage, type LocationConsent } from './storage';

/** Kayıtlı rıza durumu (SORMADAN). */
export async function getLocationConsent(): Promise<LocationConsent> {
  return consentStorage.getLocationConsent();
}

/** Rıza verildi mi (SORMADAN) — pasif kontroller için. */
export async function hasLocationConsent(): Promise<boolean> {
  return (await consentStorage.getLocationConsent()) === 'granted';
}

/**
 * Konum işleme için açık rıza garanti eder. Daha önce karar verilmişse onu
 * döndürür; belirsizse KVKK açık-rıza istemini gösterir, seçimi saklar ve
 * boolean döndürür. Reddetmek hizmeti engellemez (yalnızca konum özelliği kapalı).
 */
export async function ensureLocationConsent(): Promise<boolean> {
  const existing = await consentStorage.getLocationConsent();
  if (existing === 'granted') return true;
  if (existing === 'denied') return false;

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      i18n.t('consent.location_title'),
      i18n.t('consent.location_message'),
      [
        {
          text: i18n.t('consent.location_decline'),
          style: 'cancel',
          onPress: async () => {
            await consentStorage.setLocationConsent('denied');
            resolve(false);
          },
        },
        {
          text: i18n.t('consent.location_accept'),
          onPress: async () => {
            await consentStorage.setLocationConsent('granted');
            resolve(true);
          },
        },
      ],
      { cancelable: false },
    );
  });
}

/** Rızayı belirli bir değere ayarla (ör. Profil ayarındaki geçiş). */
export async function setLocationConsent(v: 'granted' | 'denied'): Promise<void> {
  await consentStorage.setLocationConsent(v);
}

/** Rızayı geri al (KVKK ilgili kişi hakkı). */
export async function revokeLocationConsent(): Promise<void> {
  await consentStorage.setLocationConsent('denied');
}
