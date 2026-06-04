import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma.client.js';
import { config } from '../../config/index.js';

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '30d';

interface AccessPayload {
    userId: number;
}

interface RefreshPayload {
    userId: number;
    type: 'refresh';
}

/**
 * Bir kullanıcı için access (kısa ömürlü) ve refresh (uzun ömürlü) token üretir.
 */
const generateTokens = (userId: number) => {
    const token = jwt.sign({ userId } as AccessPayload, config.jwtSecret, {
        expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = jwt.sign(
        { userId, type: 'refresh' } as RefreshPayload,
        config.jwtSecret,
        { expiresIn: REFRESH_TOKEN_TTL }
    );
    return { token, refreshToken };
};

// Kullanıcı kayıt servisi
export const registerUser = async (email: string, pass: string, name: string) => {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Bu email adresi zaten kullanılıyor.');
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
    return { user: userWithoutPassword, ...generateTokens(user.id) };
};

// Kullanıcı giriş servisi
export const loginUser = async (email: string, pass: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error('Geçersiz email veya şifre.');
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password_hash);
    if (!isPasswordValid) {
        throw new Error('Geçersiz email veya şifre.');
    }

    const { password_hash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...generateTokens(user.id) };
};

/**
 * Geçerli bir refresh token karşılığında yeni bir access token (ve refresh token) üretir.
 */
export const refreshAccessToken = async (refreshToken: string) => {
    let decoded: RefreshPayload;
    try {
        decoded = jwt.verify(refreshToken, config.jwtSecret) as RefreshPayload;
    } catch {
        throw new Error('Geçersiz veya süresi dolmuş refresh token.');
    }

    if (decoded.type !== 'refresh') {
        throw new Error('Geçersiz token tipi.');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
        throw new Error('Kullanıcı bulunamadı.');
    }

    return generateTokens(user.id);
};
