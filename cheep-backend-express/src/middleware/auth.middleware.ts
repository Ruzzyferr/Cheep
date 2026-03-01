import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.client.js';

// JWT payload tipini genişlet
interface JwtPayload {
    userId: number;
}

/**
 * Authentication Middleware
 * 
 * JWT token'ı verify eder ve user bilgilerini req.user'a ekler
 * 
 * @usage
 * router.get('/protected', authenticate, controller);
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // 1. Authorization header'ını kontrol et
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Yetkilendirme başarısız. Token bulunamadı.',
            });
            return;
        }

        // 2. Token'ı çıkar
        const token = authHeader.split(' ')[1];

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Yetkilendirme başarısız. Token bulunamadı.',
            });
            return;
        }

        // 3. Token'ı verify et
        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                res.status(401).json({
                    success: false,
                    message: 'Token süresi dolmuş. Lütfen tekrar giriş yapın.',
                });
                return;
            }
            
            if (err instanceof jwt.JsonWebTokenError) {
                res.status(401).json({
                    success: false,
                    message: 'Geçersiz token.',
                });
                return;
            }

            throw err;
        }

        // 4. User'ı database'den çek
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                created_at: true,
                updated_at: true,
            },
        });

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bulunamadı.',
            });
            return;
        }

        // 5. User bilgilerini request'e ekle
        req.user = user;

        // 6. Bir sonraki middleware'e geç
        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        res.status(500).json({
            success: false,
            message: 'Kimlik doğrulama sırasında bir hata oluştu.',
        });
    }
};

/**
 * Optional Authentication Middleware
 * 
 * Token varsa verify eder, yoksa devam eder
 * Public endpoint'lerde user bilgisi almak için kullanılır
 * 
 * @usage
 * router.get('/public-but-personalized', optionalAuthenticate, controller);
 */
export const optionalAuthenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        // Token yoksa direkt devam et
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            next();
            return;
        }

        try {
            const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    created_at: true,
                    updated_at: true,
                },
            });

            if (user) {
                req.user = user;
            }
        } catch (err) {
            // Token geçersiz ama optional olduğu için hata vermeden devam et
            console.warn('Optional auth failed:', err);
        }

        next();
    } catch (error) {
        console.error('Optional Auth Middleware Error:', error);
        next();
    }
};

