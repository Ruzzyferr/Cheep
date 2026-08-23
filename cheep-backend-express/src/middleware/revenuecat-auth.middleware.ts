import { type Request, type Response, type NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config/index.js';

/**
 * RevenueCat webhook kimlik doğrulaması.
 *
 * RevenueCat imza atmaz; panelde tanımladığımız sabit `Authorization` başlığını
 * yollar. Karşılaştırma sabit zamanlı yapılır — değişken zamanlı karşılaştırma
 * sırrı karakter karakter tahmin etmeye açık kapı bırakır.
 *
 * Sır tanımlı değilse uç KAPALIDIR: yapılandırma eksikliği, doğrulamasız
 * abonelik yazma iznine dönüşmemeli.
 */
export const requireRevenueCatSecret = (req: Request, res: Response, next: NextFunction): void => {
    const expected = config.revenuecat.webhookSecret;
    if (!expected) {
        res.status(503).json({ success: false, message: 'Abonelik webhook ucu yapılandırılmamış.' });
        return;
    }

    const got = req.header('authorization') ?? '';
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        res.status(401).json({ success: false, message: 'Geçersiz webhook anahtarı.' });
        return;
    }

    next();
};
