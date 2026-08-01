/**
 * Uygulama sürüm politikası — zorunlu güncelleme kapısının sunucu tarafı.
 *
 * İKİ AYRI EŞİK, bilerek:
 *
 *   `minSupported` — bu sürümün ALTINDAKİ istemci uygulamayı KULLANAMAZ.
 *   `latest`       — mağazadaki güncel sürüm; yalnızca yumuşak bilgilendirme.
 *
 * "Yeni sürüm çıktıysa herkesi kilitle" davranışı cazip ama tehlikeli: Play
 * kademeli yayında güncellemeyi önce %20'ye açar. Tek eşik olsaydı kalan %80
 * uygulamayı kullanamaz AMA güncelleyemezdi de — mağazada henüz yeni sürüm
 * görünmüyor. Ayrıca her yama kullanıcıyı işinin ortasında keserdi.
 *
 * İkisini eşitlemek (`ANDROID_MIN_SUPPORTED_VERSION = ANDROID_LATEST_VERSION`)
 * yine de mümkün; o zaman herkes kilitlenir. Karar env'de, kodda değil.
 *
 * YAPILANDIRILMAMIŞ ORTAM KİMSEYİ KİLİTLEMEZ: eşikler boşsa kapı açık kalır.
 * Yanlış bir env değeriyle tüm kullanıcı tabanını dışarıda bırakmak, güncel
 * olmayan bir istemcinin bir gün daha çalışmasından çok daha kötü.
 */

export type Platform = 'android' | 'ios';

export interface VersionPolicy {
    /** Bu sürümün altındaki istemci kilitlenir. Boşsa kilit yok. */
    minSupported: string;
    /** Mağazadaki güncel sürüm. Boşsa "yeni sürüm var" bildirimi gösterilmez. */
    latest: string;
    /** "Güncelle" düğmesinin açacağı adres. Her zaman dolu. */
    storeUrl: string;
}

const PLAY_PACKAGE = 'com.cheep.mobile';
const STORE_URL: Record<Platform, string> = {
    android: `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`,
    // iOS henüz yayında değil; kullanıcı boş bir düğmeye basmasın diye
    // arama sayfasına götürüyoruz.
    ios: 'https://apps.apple.com/search?term=cheep',
};

/**
 * İki sürümü sayısal olarak karşılaştırır.
 *
 * Metin karşılaştırması KULLANILAMAZ: '1.10.0' < '1.9.0' metin olarak doğru
 * ama sürüm olarak yanlış — kullanıcı güncel sürümdeyken kilitlenirdi.
 *
 * Ön-sürüm etiketi (`-beta.2`) yok sayılır: aynı yayının test yapısını
 * kilitlemenin anlamı yok.
 *
 * @returns a > b ise pozitif, a < b ise negatif, eşitse 0
 */
export function compareVersions(a: string, b: string): number {
    const parts = (v: string): number[] =>
        String(v ?? '')
            .split('-')[0]
            .split('.')
            .map((p) => {
                const n = Number.parseInt(p, 10);
                // Sayı olmayan parça 0 sayılır. Çöp girdi yüzünden bir
                // istemciyi "çok eski" ilan etmek istemiyoruz.
                return Number.isFinite(n) ? n : 0;
            });

    const left = parts(a);
    const right = parts(b);
    const len = Math.max(left.length, right.length);

    for (let i = 0; i < len; i++) {
        const diff = (left[i] ?? 0) - (right[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * İstemci sürümü eşiğin altında mı?
 *
 * Eşik yoksa ya da istemci sürümü okunamıyorsa `false` — yani KİLİTLEME.
 * Bu, kapının bilinçli olarak hata affedici tarafı.
 */
export function isOutdated(clientVersion: string | undefined, threshold: string | undefined): boolean {
    if (!threshold) return false;
    if (!clientVersion) return false;
    return compareVersions(clientVersion, threshold) < 0;
}

/** Ortam değişkenlerinden platform politikasını çıkarır. */
export function resolveVersionPolicy(
    platform: Platform,
    env: Record<string, string | undefined> = process.env,
): VersionPolicy {
    // Bilinmeyen platform android sayılır: en yaygın istemci ve tek yayında
    // olan mağaza.
    const target: Platform = platform === 'ios' ? 'ios' : 'android';
    const prefix = target === 'ios' ? 'IOS' : 'ANDROID';

    return {
        minSupported: env[`${prefix}_MIN_SUPPORTED_VERSION`]?.trim() ?? '',
        latest: env[`${prefix}_LATEST_VERSION`]?.trim() ?? '',
        storeUrl: STORE_URL[target],
    };
}
