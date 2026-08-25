/**
 * Refresh token sürüm (revocation) mantığı — saf ve test edilebilir.
 *
 * Her kullanıcının `token_version` (int) sütunu vardır. Refresh token üretilirken
 * o anki sürüm token'a `tv` claim'i olarak gömülür. Logout veya parola değişiminde
 * sütun +1 artırılır; böylece dağıtılmış tüm eski refresh token'lar (eski `tv`)
 * anında geçersiz olur — çalınan bir refresh token iptal edilebilir hale gelir.
 */

export interface RefreshPayload {
    userId: number;
    type: 'refresh';
    /** Token üretildiği andaki kullanıcı token_version'ı. Eski (tv'siz) tokenlar geçersizdir. */
    tv?: number;
}

/**
 * Refresh token'ın taşıdığı sürüm, kullanıcının güncel `token_version`'ı ile eşleşiyor mu?
 * Eşleşmiyorsa (logout/parola değişimi ile bump edilmiş) ya da `tv` hiç yoksa (eski token)
 * token geçersizdir → yeniden giriş gerekir.
 */
export function isRefreshTokenCurrent(
    tokenVersion: number | undefined,
    userTokenVersion: number
): boolean {
    return (
        typeof tokenVersion === 'number' &&
        Number.isInteger(tokenVersion) &&
        tokenVersion === userTokenVersion
    );
}

/**
 * Access token'in tasidigi surum kullanicinin guncel `token_version`i ile
 * uyusuyor mu?
 *
 * REFRESH'TEN FARKLI KURAL — `tv` YOKSA GECERLI SAYILIR:
 *
 * Refresh token 30 gun yasiyor, bu yuzden orada tv'siz bir token'i reddetmek
 * dogru (bir kez yeniden giris, sonra temiz). Access token 1 SAAT yasiyor.
 * Bu kontrol eklendigi anda sahadaki butun access token'lar tv'siz oldugu icin,
 * onlari reddetmek TUM kullanicilari ayni anda 401'e dusururdu. Tolerans
 * kendiliginden kapaniyor: bir saat icinde her token ya suresi dolup yenileniyor
 * ya da tv tasiyan yenisiyle degisiyor.
 *
 * Manipulasyona karsi: `tv` VARSA tam sayi ve esit olmak ZORUNDA; ondalikli,
 * NaN ya da farkli bir deger reddedilir.
 */
export function isAccessTokenCurrent(
    tokenVersion: number | undefined,
    userTokenVersion: number
): boolean {
    if (tokenVersion === undefined) return true; // eski token — bkz. yukaridaki gerekce
    return Number.isInteger(tokenVersion) && tokenVersion === userTokenVersion;
}
