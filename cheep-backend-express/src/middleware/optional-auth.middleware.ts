import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.client.js';

interface JwtPayload {
    userId: number;
    type?: string;
}

/**
 * İsteğe bağlı kimlik doğrulama.
 *
 * `authenticate` ile aynı doğrulamayı yapar ama BAŞARISIZLIKTA 401 ATMAZ:
 * token yoksa, bozuksa veya süresi dolmuşsa `req.user` boş bırakılıp devam edilir.
 *
 * Neden var: destek formu hem giriş yapmış hem yapmamış kullanıcıya açık olmalı.
 * Sorun yaşayan kullanıcı çoğu zaman giriş YAPAMADIĞI için yazıyor; ulaşma yolunu
 * girişin arkasına koymak, en çok ihtiyaç duyan kişiyi dışarıda bırakır.
 *
 * Giriş yapmış kullanıcıda mesaja hesap bilgisi eklenir (kim yazdı, hangi hesap).
 */
export const optionalAuthenticate = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
        // Refresh token bearer olarak kullanılamaz (authenticate ile aynı kural).
        if (decoded.type === 'refresh') return next();

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, name: true, created_at: true, updated_at: true },
        });
        if (user) req.user = user;
    } catch {
        // Sessizce anonim devam — bu uç kimlik doğrulama gerektirmiyor.
    }

    next();
};
