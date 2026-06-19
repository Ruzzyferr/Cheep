import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma.client.js';
import { config } from '../../config/index.js';
import { AppError, conflict, notFound } from '../../utils/app-error.js';
import { isRefreshTokenCurrent, type RefreshPayload } from '../../services/refresh-token.js';

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

    const user = await prisma.user.create({
        data: {
            email,
            password_hash,
            name,
        },
    });

    const { password_hash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...generateTokens(user.id, user.token_version) };
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

    const { password_hash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...generateTokens(user.id, user.token_version) };
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
