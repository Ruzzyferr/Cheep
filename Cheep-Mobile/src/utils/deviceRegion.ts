/**
 * Cihazın bölge ayarından ülke kodu.
 *
 * Bu dosya YALNIZCA native okumayı yapıyor; seçim kuralı
 * `countryAvailability.pickRegionCountry` içinde ve saf/test edilebilir.
 * Ayrım şart: `countryAvailability` testlerden native modül kurulmadan
 * import ediliyor ve oradaki bir `expo-localization` importu dosyayı
 * çökertirdi.
 */
import { getLocales } from 'expo-localization';
import { pickRegionCountry } from './countryAvailability';

/** Kullanılabilir bir ülkeye karşılık gelen ilk cihaz bölgesi, yoksa null. */
export function getDeviceRegionCountry(): string | null {
  try {
    return pickRegionCountry((getLocales() ?? []).map((l) => l?.regionCode));
  } catch {
    // Native modül yok / okunamadı → sinyal yok, çağıran mevcut değerde kalır.
    return null;
  }
}
