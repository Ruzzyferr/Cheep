/**
 * 🌍 Hangi ülkeler GERÇEKTEN kullanılabilir?
 *
 * İKİ AYRI SORU, İKİ AYRI KAYNAK:
 *
 *  1. `SUPPORTED_COUNTRY_CODES` — "bu SÜRÜM hangi ülkeleri gösterebilir?"
 *     Çeviri dosyası, para birimi biçimi, ülke adı… hepsi pakette. Bu bir
 *     ÜST SINIR ve yalnızca yeni bir sürümle değişir.
 *
 *  2. Sunucunun `/app/countries` listesi — "hangisinde GERÇEKTEN fiyat var?"
 *     Bu bir KAPI ve veri canlıya alındığı anda değişir.
 *
 * Etkin liste ikisinin KESİŞİMİ.
 *
 * NEDEN BÖYLE: eskiden tek kaynak istemcideki sabit listeydi ve bu, her ülke
 * açılışında KIRILGAN BİR SIRA dayatıyordu — önce veriyi canlıya al, SONRA
 * sürüm çıkar. Sıra bozulursa (sürüm önce çıkarsa) o ülkedeki kullanıcının
 * kataloğu BOŞ oluyor ve bunun hiçbir hata mesajı yok: uygulama çalışıyor,
 * sadece hiçbir ürün yok. Şimdi sıra bozulsa bile ülke görünmüyor; veri
 * sonradan geldiğinde ise YÜKLÜ uygulamalarda kendiliğinden beliriyor.
 *
 * ÇEVRİMDIŞI DAVRANIŞ: liste diskte saklanıyor. Uçak modunda açılan uygulama
 * en son bilinen listeyi kullanır; hiç bilinmiyorsa (ilk açılış + ağ yok)
 * `COLD_START_FALLBACK`'e düşer. ASLA boş liste dönmez — boş liste, ülke
 * seçicinin bomboş çıkması demek olurdu.
 */
import { storage, STORAGE_KEYS } from './storage';

/**
 * Uygulamanın PAKETİNDE karşılığı olan ülkeler (çeviri + para birimi + ad).
 *
 * Buraya bir ülke eklemek onu KULLANILABİLİR YAPMAZ — yalnızca sunucu o ülkede
 * veri olduğunu söylediğinde görünür (bkz. dosya başı). Bu yüzden sürüm ile
 * veri arasındaki sıra artık kritik değil.
 */
export const SUPPORTED_COUNTRY_CODES = ['TR', 'PL', 'HR', 'HU', 'RO'] as const;

export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

/**
 * İlk açılışta ağ yoksa kullanılan liste. Sürümün çıktığı anda canlı olduğu
 * BİLİNEN ülkeler. Sunucudan yanıt gelir gelmez bunun yerini alır, o yüzden
 * güncel olmaması kalıcı bir soruna yol açmaz.
 */
export const COLD_START_FALLBACK: readonly string[] = ['TR', 'PL'];

let cached: readonly string[] | null = null;

/** Sunucu listesini paketin desteklediğiyle kesiştirir (SAF). */
export function intersectWithSupported(serverCodes: readonly string[]): string[] {
  const supported = new Set<string>(SUPPORTED_COUNTRY_CODES);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of serverCodes) {
    const code = String(raw || '').trim().toUpperCase();
    if (supported.has(code) && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

/**
 * Şu an kullanılabilir ülkeler. SENKRON — çağıran her yer (ülke kapısı, seçici)
 * render sırasında buna bakıyor.
 */
export function getAvailableCountryCodes(): readonly string[] {
  return cached ?? COLD_START_FALLBACK;
}

export function isCountryAvailable(code?: string | null): boolean {
  if (!code) return false;
  return getAvailableCountryCodes().includes(code.toUpperCase());
}

/** Test yardımcısı — modül durumunu sıfırlar. */
export function __resetAvailableCountries(next: readonly string[] | null = null) {
  cached = next;
}

/** Diskteki son bilinen listeyi belleğe alır (uygulama açılışında). */
export async function loadCachedAvailableCountries(): Promise<readonly string[]> {
  try {
    const raw = await storage.getItem(STORAGE_KEYS.AVAILABLE_COUNTRIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const codes = intersectWithSupported(parsed);
        // BOŞ LİSTEYİ KABUL ETME: diskte bozuk/eski bir kayıt varsa ülke
        // seçici bomboş çıkar ve kullanıcının hiçbir çıkışı kalmaz.
        if (codes.length > 0) cached = codes;
      }
    }
  } catch {
    /* bozuk kayıt → yedek listede kal */
  }
  return getAvailableCountryCodes();
}

/**
 * Sunucudan tazeler ve diske yazar.
 *
 * Hata durumunda SESSİZCE eski listede kalır: ağ yok diye kullanıcının ülke
 * seçicisini boşaltmak, kullanılabilirlik bilgisinin bayat olmasından çok
 * daha kötü.
 */
export async function refreshAvailableCountries(
  fetchCodes: () => Promise<readonly string[]>,
): Promise<readonly string[]> {
  try {
    const codes = intersectWithSupported(await fetchCodes());
    if (codes.length > 0) {
      cached = codes;
      await storage.setItem(STORAGE_KEYS.AVAILABLE_COUNTRIES, JSON.stringify(codes));
    }
  } catch {
    /* ağ/sunucu hatası → eski liste geçerli kalır */
  }
  return getAvailableCountryCodes();
}

/**
 * Cihaz bölge kodları arasından kullanılabilir İLK ülkeyi seçer (SAF).
 *
 * NEDEN VAR: ülke varsayılanı yalnızca GPS'ten geliyordu ve GPS başarısız
 * olduğunda (izin reddedildi, kapalı mekân, emülatör) sabit `TR`ye düşüyordu.
 * Sonuç: konum iznini reddedip ülke adımını "şimdilik geç" ile atlayan bir
 * HIRVAT kullanıcı Türk marketlerini ve ₺ fiyatlarını görüyordu — hiçbir hata
 * mesajı olmadan. Üretim veritabanında doğrulandı.
 *
 * Cihaz bölgesi GPS'ten zayıf ama İZİN GEREKTİRMEYEN bir sinyal, dolayısıyla
 * sabit bir varsayılandan her zaman iyi. Sıralama: GPS → cihaz bölgesi → `TR`.
 *
 * Native okuma bilerek DIŞARIDA (`utils/deviceRegion.ts`): bu dosya testlerden
 * native modül kurmadan import ediliyor ve buradaki bir `expo-localization`
 * importu tüm dosyayı çökertirdi.
 */
export function pickRegionCountry(
  regions: readonly (string | null | undefined)[],
): string | null {
  for (const region of regions) {
    if (typeof region !== 'string') continue;
    const code = region.trim().toUpperCase();
    if (code && isCountryAvailable(code)) return code;
  }
  return null;
}
