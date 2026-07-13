/**
 * 🔐 KVKK — Konum açık rıza yönetimi (6698 m.5 / m.10; Kurul 2018/90).
 *
 * OS'un konum izni ≠ KVKK açık rızası. Bu yüzden cihaz konumu işlenmeden ÖNCE,
 * aydınlatmadan AYRI, opt-in (varsayılan kapalı), hizmet şartına bağlanmamış ve
 * iptal edilebilir bir açık rıza alınır. Rıza cihazda saklanır.
 */
import { Alert } from 'react-native';
import i18n from '../i18n';
import { consentStorage, locationStorage, type LocationConsent } from './storage';

/** Kayıtlı rıza durumu (SORMADAN). */
export async function getLocationConsent(): Promise<LocationConsent> {
  return consentStorage.getLocationConsent();
}

/** Rıza verildi mi (SORMADAN) — pasif kontroller için. */
export async function hasLocationConsent(): Promise<boolean> {
  return (await consentStorage.getLocationConsent()) === 'granted';
}

/**
 * KVKK açık-rıza istemini HER ZAMAN gösterir, seçimi saklar ve sonucu döndürür.
 * Kullanıcının açık talebiyle çağrılır (Profil'deki konum satırı) — bu yüzden
 * daha önce 'denied' olması istemi engellemez, aksi halde rıza bir kez kapandığında
 * bir daha AÇILAMAZDI (tek yönlü kapı).
 */
export async function promptLocationConsent(): Promise<boolean> {
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
            await locationStorage.clearLocation();
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

/**
 * Konum işleme için açık rıza garanti eder. Daha önce karar verilmişse onu
 * döndürür; belirsizse KVKK açık-rıza istemini gösterir. Reddetmek hizmeti
 * engellemez (yalnızca konum özelliği kapalı).
 *
 * Bir kez reddedildiyse İSTEM TEKRAR GÖSTERİLMEZ (kullanıcıyı rahatsız etme).
 * Kullanıcı fikrini değiştirmek isterse Profil > "Konum izni (KVKK)" satırından
 * promptLocationConsent() ile yeniden açar.
 */
export async function ensureLocationConsent(): Promise<boolean> {
  const existing = await consentStorage.getLocationConsent();
  if (existing === 'granted') return true;
  if (existing === 'denied') return false;
  return promptLocationConsent();
}

/** Rızayı belirli bir değere ayarla (ör. Profil ayarındaki geçiş). */
export async function setLocationConsent(v: 'granted' | 'denied'): Promise<void> {
  await consentStorage.setLocationConsent(v);
}

/**
 * Rızayı geri al (KVKK ilgili kişi hakkı — m.7 "verinin silinmesi").
 * Saklanan koordinat da SİLİNİR: aksi halde ekranda "konum işlenmiyor" yazarken
 * eski koordinat sunucuya gönderilmeye devam ederdi.
 */
export async function revokeLocationConsent(): Promise<void> {
  await consentStorage.setLocationConsent('denied');
  await locationStorage.clearLocation();
}
