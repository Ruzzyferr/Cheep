/**
 * 📍 Geo Utilities
 * Haversine mesafe hesabı + cihaz konumu (izinli, cache'li).
 */

import * as Location from 'expo-location';
import { locationStorage } from './storage';
import { ensureLocationConsent, getLocationConsent } from './consent';

export interface Coords {
  lat: number;
  lon: number;
}

/**
 * Uygulamanın desteklediği ülke kodları. Ülke tespiti yapan her fonksiyon
 * (getCountryCodeInteractive, reverseGeocodeCountry) bu kümenin DIŞINDAKİ bir
 * tespit için null döner → çağıran taraf son bilinen ülkeye/kullanıcı seçimine
 * düşer, geçersiz kod asla x-country header'ına sızmaz. Konum sayfasındaki
 * ülke-yalnızca seçim de bu listeden üretilir.
 * (LocaleContext'i import ETME — döngü riski.)
 */
export const SUPPORTED_COUNTRY_CODES = ['TR', 'PL'] as const;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** İki koordinat arası kuş uçuşu mesafe (km). */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** İnsan-okunur mesafe metni. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Cache'lenmiş bir konumun "şu anki konumum" sayılabileceği azami yaş.
 * Cache YALNIZCA anlık bir GPS hatasını (kapalı mekân, soğuk fix) tolere etmek
 * içindir — kullanıcının nerede olduğunu HATIRLAMAK için değil. Daha eski bir
 * nokta kullanılırsa, şehir değiştiren kullanıcı eski şehrinin etrafında
 * filtrelenir ve "yakında market yok" görür.
 */
export const LOCATION_MAX_AGE_MS = 30 * 60 * 1000; // 30 dk

/**
 * Cihaz konumunu döndürür.
 *
 * SÖZLEŞME — bu fonksiyon HİÇBİR ZAMAN diyalog göstermez (ne KVKK istemi ne
 * de OS izin modalı): rızayı ve OS iznini yalnızca PASİF olarak OKUR. Sormak
 * kapının (runLocationGate/ensureLocationReady) ve Profil'in açık rıza
 * anahtarının işidir — burada requestForegroundPermissionsAsync() ÇAĞRILMAZ.
 * Neden: LocationContext artık kapıyı çalıştırdıktan HEMEN SONRA bu fonksiyonu
 * çağırıyor; iki fonksiyon da isteseydi, kapının reddedilen bir isteğinin
 * hemen ardından burası ikinci bir sistem modalı açardı — Android 11+'ta arka
 * arkaya iki ret, kullanıcının izni KALICI OLARAK reddetmesine (canAskAgain=false)
 * yol açar ve uygulama bir daha asla soramaz.
 *
 * Null dönen her durumda çağıran taraf konum filtresi UYGULAMAZ (tüm
 * marketleri gösterir); eski/yanlış bir noktayla filtrelemekten iyidir:
 *   • KVKK rızası yok           → null  (+ saklanan koordinat silinir)
 *   • OS konum izni yok         → null  (+ saklanan koordinat silinir; SORULMAZ)
 *   • GPS anlık hata verdi      → TAZE cache (≤30 dk), yoksa null
 *   • GPS başarılı              → taze koordinat (zaman damgasıyla cache'lenir)
 */
export async function getUserLocation(): Promise<Coords | null> {
  try {
    // KVKK: OS izninden ÖNCE açık rıza. Rıza yoksa konum HİÇ işlenmez — eski
    // koordinat da tutulmaz (rızasız veri işleme olurdu).
    //
    // PASİF okuma (ensureLocationConsent DEĞİL): rıza henüz KARARSIZSA
    // ensureLocationConsent istem gösterirdi ve bu fonksiyonun "hiç diyalog
    // göstermem" sözü kırılırdı. Bugün buraya kapıdan sonra gelindiği için
    // rıza hep karara bağlanmış oluyor — ama sözleşmeyi yoruma değil KODA
    // bağlıyoruz: rıza 'granted' değilse konum yok, nokta.
    if ((await getLocationConsent()) !== 'granted') {
      await locationStorage.clearLocation();
      return null;
    }
    // PASİF okuma — asla sormaz. İzin isteme tamamen kapının (gate) sorumluluğu.
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      await locationStorage.clearLocation();
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords: Coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    await locationStorage.saveLocation(coords);
    return coords;
  } catch {
    // Anlık GPS hatası — yalnızca TAZE cache'e düş. Bayat nokta asla kullanılmaz.
    return await locationStorage.getFreshLocation(LOCATION_MAX_AGE_MS);
  }
}

/**
 * AKTİF ülke tespiti — onboarding ülke adımı için: ÖNCE OS izni ister, izin
 * verilirse KVKK açık rızasını sorar. Biri bile reddedilirse null → manuel
 * seçici devrede kalır.
 *
 * SIRA BİLEREK BÖYLE (App Store 5.1.1(iv)): sistem izin isteminin önüne,
 * kullanıcının kapatıp isteği atlayabileceği kendi diyaloğumuzu koyamayız.
 * Ayrıntılı gerekçe locationGate.ensureLocationReady başlığında.
 */
export async function getCountryCodeInteractive(): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    // Koordinat OKUNMADAN ÖNCE açık rıza — KVKK m.5 işleme için rıza arar.
    const consented = await ensureLocationConsent();
    if (!consented) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const iso = places[0]?.isoCountryCode?.toUpperCase();
    return iso && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(iso) ? iso : null;
  } catch {
    return null;
  }
}

/**
 * Verilen koordinatın ISO ülke kodunu çözer. Desteklenmeyen ülke veya hata → null.
 * GPS OKUMAZ, verilen koordinatı çözer — çapa akışında konum zaten elimizde,
 * ikinci kez GPS istemek (ve ikinci bir izin diyaloğu riski) gereksizdir.
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
