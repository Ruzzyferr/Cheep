import { param as paramValue } from '../utils/request-params.js';
import { type Request, type Response, type NextFunction } from 'express';

/**
 * Numeric route param doğrulama middleware fabrikası.
 *
 * Belirtilen route param'ın pozitif tam sayı olduğunu doğrular. Geçersizse
 * (NaN, 0, negatif, ondalık, taşkın) Prisma'ya `NaN` ulaşmadan 400 döner.
 *
 * @usage router.get('/:id', validateIdParam('id'), controller)
 */
export const validateIdParam = (param = 'id') => {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Express 5.2: params değerleri string | string[] — tekile daralt.
        const raw = paramValue(req.params[param]);
        // Sadece rakamlardan oluşmalı (işaret/ondalık/boşluk yok).
        if (raw === undefined || !/^\d+$/.test(raw)) {
            res.status(400).json({
                success: false,
                message: `Geçersiz '${param}' parametresi.`,
            });
            return;
        }
        const value = Number(raw);
        if (!Number.isSafeInteger(value) || value <= 0) {
            res.status(400).json({
                success: false,
                message: `Geçersiz '${param}' parametresi.`,
            });
            return;
        }
        next();
    };
};
