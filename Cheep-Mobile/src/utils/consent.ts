/**
 * 🔐 KVKK — Konum açık rıza yönetimi (6698 m.5 / m.10; Kurul 2018/90).
 *
 * OS'un konum izni ≠ KVKK açık rızası. Bu yüzden cihaz konumu işlenmeden ÖNCE,
 * aydınlatmadan AYRI, opt-in (varsayılan kapalı), hizmet şartına bağlanmamış ve
 * iptal edilebilir bir açık rıza alınır. Rıza cihazda saklanır.
 */
import { Alert } from 'react-native';
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
      'Konumun işlensin mi? (KVKK açık rıza)',
      'Cheep, yalnızca sana en yakın market şubelerini ve gerçek mesafeleri göstermek için ' +
        'yaklaşık konumunu işler. Konumun cihazında kalır, arka planda toplanmaz ve üçüncü ' +
        'kişilerle paylaşılmaz.\n\n' +
        'Bu hizmetin zorunlu şartı DEĞİLDİR; reddetsen de Cheep’i kullanmaya devam edebilirsin. ' +
        'Rızanı istediğin an Profil › Gizlilik’ten geri alabilirsin.',
      [
        {
          text: 'Hayır, teşekkürler',
          style: 'cancel',
          onPress: async () => {
            await consentStorage.setLocationConsent('denied');
            resolve(false);
          },
        },
        {
          text: 'Evet, açık rıza veriyorum',
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
