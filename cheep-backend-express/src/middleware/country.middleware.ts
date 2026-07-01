import { type Request, type Response, type NextFunction } from 'express';
import { getCountryByCode, DEFAULT_COUNTRY_CODE } from '../utils/country.js';

/**
 * Resolve Country Middleware
 *
 * İsteğin ülkesini belirler ve req.country'ye yazar:
 *  - `x-country` header'ı (mobil cihazın konumundan/seçiminden) öncelikli
 *  - yoksa DEFAULT_COUNTRY_CODE (TR)
 *
 * Servisler ürün/mağaza sorgularını req.country.id ile süzer.
 */
export const resolveCountry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const headerCode = req.header('x-country')?.trim().toUpperCase();
        const c = await getCountryByCode(headerCode || DEFAULT_COUNTRY_CODE);
        req.country = { id: c.id, code: c.code, currency: c.currency };
        next();
    } catch (error) {
        // Bilinmeyen ülke kodu → 400 yerine default'a düşmek yerine açık hata ver
        res.status(400).json({ success: false, message: (error as Error).message });
    }
};
