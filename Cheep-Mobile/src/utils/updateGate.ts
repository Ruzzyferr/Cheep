/**
 * 🚧 Zorunlu güncelleme kapısı — karar mantığı.
 *
 * Sunucu iki eşik veriyor:
 *   `minSupported` — bu sürümün ALTINDAKİ istemci uygulamayı kullanamaz
 *   `latest`       — mağazadaki güncel sürüm (yalnızca yumuşak uyarı)
 *
 * BU KARAR TEK YÖNLÜ HATA AFFEDER. Yanlış bir "kilitle" kararı kullanıcıyı
 * uygulamadan tamamen dışarıda bırakır ve elinde yapabileceği hiçbir şey
 * kalmaz. Yanlış bir "kilitleme" kararının maliyeti ise eski bir istemcinin
 * bir gün daha çalışması. Bu yüzden her belirsizlik durumunda kapı AÇIK kalır:
 * sunucuya ulaşılamadı, eşik boş, sürüm okunamadı, mağaza bağlantısı yok.
 */

export type UpdateGateDecision =
    /** Uygulama kullanılamaz; kapatılamayan modal. */
    | 'blocked'
    /** Yeni sürüm var; kapatılabilir bilgilendirme. */
    | 'optional'
    /** Yapacak bir şey yok. */
    | 'none';

export interface VersionPolicy {
    minSupported: string;
    latest: string;
    storeUrl: string;
}

/**
 * İki sürümü sayısal olarak karşılaştırır.
 *
 * Metin karşılaştırması KULLANILAMAZ: '1.10.0' < '1.9.0' metin olarak doğru
 * ama sürüm olarak yanlış — güncel sürümdeki kullanıcı kilitlenirdi.
 */
export function compareVersions(a: string, b: string): number {
    const parts = (v: string): number[] =>
        String(v ?? '')
            .split('-')[0]
            .split('.')
            .map((p) => {
                const n = Number.parseInt(p, 10);
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
 * Kapı kararı.
 *
 * @param clientVersion Yüklü uygulamanın sürümü (`Constants.expoConfig.version`)
 * @param policy Sunucudan gelen politika; ulaşılamadıysa `null`
 */
export function decideUpdateGate(
    clientVersion: string | undefined,
    policy: VersionPolicy | null,
): UpdateGateDecision {
    // Sunucuya ulaşılamadı ya da sürüm okunamadı → kullanıcıyı içeri al.
    if (!policy || !clientVersion) return 'none';

    // Çıkışı olmayan bir kapı kurmayız: mağaza bağlantısı yoksa kilitlemek
    // kullanıcıya "güncelle" deyip güncelleme yolu vermemek olurdu.
    if (!policy.storeUrl) return 'none';

    if (policy.minSupported && compareVersions(clientVersion, policy.minSupported) < 0) {
        return 'blocked';
    }

    if (policy.latest && compareVersions(clientVersion, policy.latest) < 0) {
        return 'optional';
    }

    return 'none';
}
