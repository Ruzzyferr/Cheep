import crypto from 'crypto';

/**
 * E-posta doğrulama kodu için saf (yan etkisiz) yardımcılar.
 * Kolay test edilebilmesi için zamanı parametre olarak alır.
 */
export const CODE_TTL_MS = 15 * 60 * 1000; // 15 dakika

/** Kriptografik olarak güvenli 6 haneli kod ("000000"–"999999"). */
export function generateVerificationCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Kodun son geçerlilik anını döndürür. */
export function verificationExpiry(now: Date = new Date()): Date {
    return new Date(now.getTime() + CODE_TTL_MS);
}

/** Kod süresi dolmuş mu? (expires yoksa süresi dolmuş sayılır) */
export function isCodeExpired(
    expires: Date | null | undefined,
    now: Date = new Date()
): boolean {
    if (!expires) return true;
    return now.getTime() > expires.getTime();
}

/** Girdi tam 6 haneli rakam mı? */
export function isValidCodeFormat(code: string): boolean {
    return /^\d{6}$/.test(code);
}
