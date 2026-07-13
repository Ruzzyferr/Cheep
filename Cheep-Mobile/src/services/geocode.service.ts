/**
 * 🔎 Adres → alışveriş çapası.
 *
 * Serbest adres girişinin bilinen zayıflığı SESSİZ YANLIŞ EŞLEŞMEDİR: geocoder
 * yanlış bir noktayı döndürür, uygulama onu sorgusuz kabul eder, kullanıcı yanlış
 * mesafeler görür. Üç kapı bunu engeller:
 *   1) Ülke kapısı  — nokta TR/PL dışındaysa reddet.
 *   2) Şube kapısı  — MAX_RADIUS_KM içinde market yoksa KOORDİNATSIZ pin ver
 *                     (yalnızca ülke), aksi halde yarıçap filtresi boş ekran üretir.
 *   3) Geocoder yok — bazı Android'lerde geocodeAsync çalışmaz; bunu sessiz "sonuç
 *                     yok" gibi göstermek yerine açıkça bildir.
 */
import * as Location from 'expo-location';
import { storeService } from './store.service';
import { SUPPORTED_COUNTRY_CODES, type Coords } from '../utils/geo';
import { MAX_RADIUS_KM, type PinnedAnchor } from '../utils/anchor';

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

/**
 * TEL ÜZERİNDEKİ YUVARLAMA PAYI (km).
 *
 * /stores/nearby uç noktası mesafeyi TEK ONDALIĞA yuvarlayarak serileştiriyor
 * (`Math.round(n.distanceKm * 10) / 10`), ama karşılaştırma (compare) filtresi
 * sunucuda YUVARLANMAMIŞ haversine ile çalışıyor (`distanceKm > maxKm → ele`).
 * Yani telden gelen r değeri, gerçek mesafeyi ±0.05 km belirsizlikle taşır:
 *   gerçek d ∈ [r - 0.05, r + 0.05]
 *
 * Kapı, ham `r <= MAX_RADIUS_KM` karşılaştırması yaptığında bu belirsizliği YOK
 * SAYAR: 5.04 km'deki bir şube tele 5.0 olarak çıkar, kapı "içeride" der ve
 * KOORDİNATLI pin verir; kullanıcı en geniş yarıçapı (5 km) seçtiğinde compare
 * gerçek 5.04'ü görüp şubeyi ELER → HİÇBİR yarıçapın kullanamayacağı bir pin ve
 * BOŞ EKRAN. Bu yüzden kapı payı GÜVENLİ yöne (daraltarak) uygular: yalnızca
 * r + 0.05 <= MAX_RADIUS_KM olan satırlar isabet sayılır. Belirsizlikte mesafe
 * filtresi KAPANIR (koordinatsız pin → tüm marketler listelenir) — projenin
 * merkezî kuralı budur; ters yön (payı genişletmek) boş ekranı ÜRETİR.
 */
export const WIRE_ROUNDING_KM = 0.05;

/** Şube kapısının fiilen kullandığı eşik (telden gelen, yuvarlanmış değer için). */
export const BRANCH_GATE_MAX_KM: number = MAX_RADIUS_KM - WIRE_ROUNDING_KM;

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

  // 2. kapı — şube. DİKKAT: /stores/nearby uç noktası bir şey BULANA KADAR sınır
  // kutusunu genişletir (±1° → ±3° → ±8°; ±8° ≈ 550–890 km, Polonya'nın tamamından
  // geniş). Yani "liste boş değil" HİÇBİR ŞEY ifade etmez — TR/PL içindeki her
  // koordinat için ülkenin öbür ucundan şubeler döner. Kapının sorması gereken
  // soru şudur: kullanıcının SEÇEBİLECEĞİ EN GENİŞ yarıçapın (MAX_RADIUS_KM)
  // içinde gerçekten bir şube var mı? Yoksa hangi yarıçap seçilirse seçilsin
  // sonuç boştur → koordinatı KULLANMA, koordinatsız (yalnızca ülke) pin ver.
  // Eşik ham MAX_RADIUS_KM değil, yuvarlama payı düşülmüş BRANCH_GATE_MAX_KM'dir
  // (uç nokta mesafeyi tek ondalığa yuvarlıyor; bkz. WIRE_ROUNDING_KM).
  let hasBranches = false;
  try {
    const nearby = await storeService.getNearbyStores(c.coords.lat, c.coords.lon, c.countryCode);
    // Temkinli: distanceKm eksik ya da sayı değilse o satır İSABET SAYILMAZ —
    // "bilinmeyen mesafe"yi "yakın" varsaymak tam da boş ekranı üreten hatadır.
    hasBranches = nearby.some(
      (n) =>
        typeof n?.distanceKm === 'number' &&
        Number.isFinite(n.distanceKm) &&
        n.distanceKm <= BRANCH_GATE_MAX_KM,
    );
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
