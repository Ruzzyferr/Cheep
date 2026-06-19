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
