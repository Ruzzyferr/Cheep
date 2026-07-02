/**
 * 📍 Geo Utilities
 * Haversine mesafe hesabı + cihaz konumu (izinli, cache'li).
 */

import * as Location from 'expo-location';
import { locationStorage } from './storage';
import { ensureLocationConsent, hasLocationConsent } from './consent';

export interface Coords {
  lat: number;
  lon: number;
}

/**
 * Uygulamanın desteklediği ülke kodları. getCountryCode() bu kümenin DIŞINDAKİ
 * bir tespit için null döner → çağıran taraf default'a (TR) düşer, geçersiz kod
 * asla x-country header'ına sızmaz. (LocaleContext'i import ETME — döngü riski.)
 */
export const SUPPORTED_COUNTRY_CODES = ['TR', 'CH', 'SE', 'DE', 'PL'] as const;

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
 * Cihaz konumunu döndürür. Önce izin ister; reddedilirse veya hata olursa
 * daha önce cache'lenmiş konuma düşer (yoksa null). Başarılı alımı cache'ler.
 */
export async function getUserLocation(): Promise<Coords | null> {
  try {
    // KVKK: OS izninden ÖNCE açık rıza. Rıza yoksa konumu HİÇ isteme; cache'e düş.
    const consented = await ensureLocationConsent();
    if (!consented) {
      return await locationStorage.getLocation();
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return await locationStorage.getLocation();
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords: Coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    await locationStorage.saveLocation(coords);
    return coords;
  } catch {
    return await locationStorage.getLocation();
  }
}

/**
 * Cihaz konumundan ISO ülke kodunu (örn. "TR", "PL") çözer (reverse-geocode).
 * İzin yoksa/başarısızsa null döner; çağıran taraf kullanıcı seçimine/default'a düşer.
 */
export async function getCountryCode(): Promise<string | null> {
  try {
    // Pasif ülke tespiti — SESSİZ: yalnızca daha önce açık rıza verildiyse konuma
    // bak, aksi halde istem gösterme (kullanıcı ülkeyi elle seçer). Rıza istemi,
    // kullanıcı aktif bir konum özelliğini (getUserLocation) kullandığında çıkar.
    if (!(await hasLocationConsent())) return null;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const iso = places[0]?.isoCountryCode?.toUpperCase();
    // Yalnızca desteklenen ülke ise döndür; değilse null → çağıran default'a düşer.
    return iso && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(iso) ? iso : null;
  } catch {
    return null;
  }
}
