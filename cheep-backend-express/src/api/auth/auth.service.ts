import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma.client.js';
import { config } from '../../config/index.js';
import { AppError, conflict, notFound, badRequest } from '../../utils/app-error.js';
import { isRefreshTokenCurrent, type RefreshPayload } from '../../services/refresh-token.js';
import {
    generateVerificationCode,
    verificationExpiry,
    isCodeExpired,
    isValidCodeFormat,
} from '../../services/email-verification.js';
import { sendVerificationEmail } from '../../services/email.service.js';
import logger from '../../utils/logger.js';

type UserRecord = { password_hash: string;[k: string]: unknown };

/** Kullanıcı nesnesinden hassas/iç alanları çıkarır (client'a dönmeden önce). */
const sanitizeUser = (user: UserRecord) => {
    const {
        password_hash: _pw,
        email_verification_code: _c,
        email_verification_expires: _e,
        ...safe
    } = user;
    return safe;
};

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '30d';

interface AccessPayload {
    userId: number;
    type: 'access';
}

/**
 * Bir kullanıcı için access (kısa ömürlü) ve refresh (uzun ömürlü) token üretir.
 * Refresh token, kullanıcının o anki `token_version`'ını `tv` claim'inde taşır;
 * bu sayede logout/parola değişiminde eski refresh token'lar geçersiz kılınabilir.
 */
const generateTokens = (userId: number, tokenVersion: number) => {
    const token = jwt.sign({ userId, type: 'access' } as AccessPayload, config.jwtSecret, {
        expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = jwt.sign(
        { userId, type: 'refresh', tv: tokenVersion } as RefreshPayload,
        config.jwtRefreshSecret,
        { expiresIn: REFRESH_TOKEN_TTL }
    );
    return { token, refreshToken };
};

// Kullanıcı kayıt servisi
export const registerUser = async (email: string, pass: string, name: string) => {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw conflict('Bu email adresi zaten kullanılıyor.');
    }

    const password_hash = await bcrypt.hash(pass, 10);

    // 6 haneli doğrulama kodu üret, hash'leyerek sakla (düz metin sadece e-postaya gider)
    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);

    const user = await prisma.user.create({
        data: {
            email,
            password_hash,
            name,
            email_verification_code: codeHash,
            email_verification_expires: verificationExpiry(),
        },
    });

    // E-postayı gönder — başarısız olsa bile kayıt akışı BOZULMAZ (kullanıcı "yeniden gönder" diyebilir)
    void sendVerificationEmail(email, name, code).catch((err) =>
        logger.error('[auth] doğrulama e-postası gönderilemedi:', err)
    );
    if (!config.emailEnabled) {
        logger.warn(`[auth] (DEV) ${email} için doğrulama kodu: ${code}`);
    }

    return { user: sanitizeUser(user), ...generateTokens(user.id, user.token_version) };
};

/**
 * E-posta doğrulama: kullanıcının girdiği 6 haneli kodu saklanan hash ile karşılaştırır.
 * Başarılıysa `email_verified = true` yapar ve kodu temizler.
 */
export const verifyEmailCode = async (userId: number, code: string) => {
    if (!isValidCodeFormat(code)) {
        throw badRequest('Doğrulama kodu 6 haneli olmalıdır.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw notFound('Kullanıcı bulunamadı.');
    }
    if (user.email_verified) {
        return { user: sanitizeUser(user) }; // zaten doğrulanmış — idempotent
    }
    if (!user.email_verification_code || isCodeExpired(user.email_verification_expires)) {
        throw new AppError('Doğrulama kodunun süresi dolmuş. Yeni kod isteyin.', 400, 'CODE_EXPIRED');
    }

    const ok = await bcrypt.compare(code, user.email_verification_code);
    if (!ok) {
        throw new AppError('Doğrulama kodu hatalı.', 400, 'CODE_INVALID');
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            email_verified: true,
            email_verification_code: null,
            email_verification_expires: null,
        },
    });

    return { user: sanitizeUser(updated) };
};

/**
 * Yeni doğrulama kodu üretip e-posta ile tekrar gönderir.
 */
export const resendVerification = async (userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw notFound('Kullanıcı bulunamadı.');
    }
    if (user.email_verified) {
        throw badRequest('E-posta adresi zaten doğrulanmış.');
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, 10);
    await prisma.user.update({
        where: { id: userId },
        data: {
            email_verification_code: codeHash,
            email_verification_expires: verificationExpiry(),
        },
    });

    void sendVerificationEmail(user.email, user.name, code).catch((err) =>
        logger.error('[auth] doğrulama e-postası (yeniden) gönderilemedi:', err)
    );
    if (!config.emailEnabled) {
        logger.warn(`[auth] (DEV) ${user.email} için yeni doğrulama kodu: ${code}`);
    }
};

// Kullanıcı giriş servisi
export const loginUser = async (email: string, pass: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new AppError('Geçersiz email veya şifre.', 401);
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password_hash);
    if (!isPasswordValid) {
        throw new AppError('Geçersiz email veya şifre.', 401);
    }

    return { user: sanitizeUser(user), ...generateTokens(user.id, user.token_version) };
};

/**
 * Geçerli bir refresh token karşılığında yeni bir access token (ve refresh token) üretir.
 * Token'ın `tv` claim'i kullanıcının güncel `token_version`'ı ile eşleşmiyorsa (iptal edilmiş)
 * reddedilir → yeniden giriş gerekir.
 */
export const refreshAccessToken = async (refreshToken: string) => {
    let decoded: RefreshPayload;
    try {
        decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as RefreshPayload;
    } catch {
        throw new AppError('Geçersiz veya süresi dolmuş refresh token.', 401);
    }

    if (decoded.type !== 'refresh') {
        throw new AppError('Geçersiz token tipi.', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
        throw notFound('Kullanıcı bulunamadı.');
    }

    if (!isRefreshTokenCurrent(decoded.tv, user.token_version)) {
        throw new AppError('Oturum geçersiz kılınmış. Lütfen tekrar giriş yapın.', 401);
    }

    return generateTokens(user.id, user.token_version);
};

/**
 * Çıkış: kullanıcının `token_version`'ını artırarak dağıtılmış tüm refresh token'ları geçersiz kılar.
 */
export const logoutUser = async (userId: number) => {
    await prisma.user.update({
        where: { id: userId },
        data: { token_version: { increment: 1 } },
    });
};

/**
 * Parola değiştirme: mevcut parolayı doğrular, yeni hash yazar ve `token_version`'ı artırarak
 * eski oturumları (refresh token'ları) sonlandırır. Çağırana taze token çifti döner.
 */
export const changePassword = async (
    userId: number,
    currentPassword: string,
    newPassword: string
) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw notFound('Kullanıcı bulunamadı.');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentValid) {
        throw new AppError('Mevcut şifre hatalı.', 401);
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
        where: { id: userId },
        data: { password_hash, token_version: { increment: 1 } },
    });

    // Eski refresh token'lar artık geçersiz; çağırana yeni geçerli çift verilir.
    return generateTokens(updated.id, updated.token_version);
};
