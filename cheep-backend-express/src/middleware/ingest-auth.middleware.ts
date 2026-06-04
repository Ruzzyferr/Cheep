import { type Request, type Response, type NextFunction } from 'express';
import { config } from '../config/index.js';

/**
 * Ingestion Auth Middleware
 *
 * Ürün/fiyat yazma (ingestion) endpoint'lerini korur. Bu endpoint'ler son
 * kullanıcılar tarafından değil, scraper tarafından `x-api-key` header'ı ile
 * çağrılır. Geçerli bir anahtar yoksa istek 401 ile reddedilir.
 *
 * @usage
 * router.post('/upsert', requireIngestKey, controller);
 */
export const requireIngestKey = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const key = req.header('x-api-key');

    if (!config.ingestApiKey || key !== config.ingestApiKey) {
        res.status(401).json({
            success: false,
            message: 'Geçersiz veya eksik API anahtarı.',
        });
        return;
    }

    next();
};
