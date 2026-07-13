/**
 * 🔎 Adres → alışveriş çapası.
 *
 * Serbest adres girişinin bilinen zayıflığı SESSİZ YANLIŞ EŞLEŞMEDİR: geocoder
 * yanlış bir noktayı döndürür, uygulama onu sorgusuz kabul eder, kullanıcı yanlış
 * mesafeler görür. Üç kapı bunu engeller:
 *   1) Ülke kapısı  — nokta TR/PL dışındaysa reddet.
 *   2) Şube kapısı  — çevresinde market yoksa KOORDİNATSIZ pin ver (yalnızca ülke),
 *                     aksi halde yarıçap filtresi boş ekran üretir.
 *   3) Geocoder yok — bazı Android'lerde geocodeAsync çalışmaz; bunu sessiz "sonuç
 *                     yok" gibi göstermek yerine açıkça bildir.
 */
import * as Location from 'expo-location';
import { storeService } from './store.service';
import { SUPPORTED_COUNTRY_CODES, type Coords } from '../utils/geo';
import type { PinnedAnchor } from '../utils/anchor';

export interface GeocodeCandidate {
  label: string;
  coords: Coords;
  /** Desteklenen ülke değilse null. */
  countryCode: string | null;
}

export interface SearchResult {
  /** false → cihazın geocoder'ı yok/çalışmıyor (boş sonuçtan FARKLI). */
  available: boolean;
  candidates: GeocodeCandidate[];
}

export type Validation =
  | { status: 'ok'; pin: PinnedAnchor }
  | { status: 'no_branches'; pin: PinnedAnchor }
  | { status: 'unsupported_country' };

/** En fazla kaç aday gösterilir — kullanıcı hangisini kastettiğini seçecek. */
const MAX_CANDIDATES = 5;

function labelOf(
  place: { city?: string | null; district?: string | null; region?: string | null; name?: string | null },
  fallback: string,
): string {
  const parts = [place.city ?? place.region, place.district ?? place.name].filter(
    (p): p is string => !!p,
  );
  return parts.length ? [...new Set(parts)].join(', ') : fallback;
}

export async function searchAddress(query: string): Promise<SearchResult> {
  let results: Location.LocationGeocodedLocation[];
  try {
    results = await Location.geocodeAsync(query);
  } catch {
    // Cihazda geocoder yok (ör. Play Services'sız Android) — sessizce "bulunamadı"
    // demek yanıltıcı olur; çağıran ayrı bir mesaj göstermeli.
    return { available: false, candidates: [] };
  }

  const candidates: GeocodeCandidate[] = [];
  for (const r of results.slice(0, MAX_CANDIDATES)) {
    const coords: Coords = { lat: r.latitude, lon: r.longitude };
    let countryCode: string | null = null;
    let label = query;
    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: r.latitude,
        longitude: r.longitude,
      });
      const p = places[0];
      const iso = p?.isoCountryCode?.toUpperCase();
      countryCode =
        iso && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(iso) ? iso : null;
      if (p) label = labelOf(p, query);
    } catch {
      /* ülke çözülemedi → countryCode null kalır, ülke kapısı reddeder */
    }
    candidates.push({ label, coords, countryCode });
  }

  return { available: true, candidates };
}

export async function validateCandidate(c: GeocodeCandidate): Promise<Validation> {
  // 1. kapı — ülke. Kodun VARLIĞI yetmez, DESTEKLENEN bir ülke olmalı: kapı kendi
  // kararını versin, çağıranın ön-eleme yaptığına güvenmesin.
  if (!c.countryCode || !(SUPPORTED_COUNTRY_CODES as readonly string[]).includes(c.countryCode)) {
    return { status: 'unsupported_country' };
  }

  // 2. kapı — şube. Çevresinde hiç market yoksa koordinatı KULLANMA: yarıçap
  // filtresi her şeyi eler ve kullanıcı boş ekran görür.
  let hasBranches = false;
  try {
    const nearby = await storeService.getNearbyStores(c.coords.lat, c.coords.lon, c.countryCode);
    hasBranches = nearby.length > 0;
  } catch {
    hasBranches = false; // ağ hatası → temkinli davran, mesafeleri kapat
  }

  const pin: PinnedAnchor = {
    coords: hasBranches ? c.coords : null,
    countryCode: c.countryCode,
    label: c.label,
  };
  return hasBranches ? { status: 'ok', pin } : { status: 'no_branches', pin };
}
