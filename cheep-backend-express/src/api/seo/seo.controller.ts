import { type Request, type Response, type NextFunction } from 'express';
import { buildExport } from './seo.service.js';
import { slugify, uniqueSlug } from '../../utils/slug.js';
import { ensureSlugs } from './slug.service.js';

/**
 * Gecelik site üretimi için tüm veriyi tek yanıtta döner.
 *
 * Ingest anahtarıyla korunuyor — herkese açık olsaydı tüm fiyat kataloğumuzu
 * tek istekle kopyalanabilir hale getirirdi.
 */
export const exportAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await buildExport();

        // Şehir slug'ları burada üretilir: aynı ülkede iki farklı şehir aynı
        // slug'a düşebilir (aksan sadeleşmesi sonrası), ayrıştırılması gerekir.
        for (const country of data.countries) {
            const taken = new Set<string>();
            country.cities.forEach((city, i) => {
                city.slug = uniqueSlug(slugify(city.name), i + 1, taken);
            });
        }

        // Yanıt büyük (~40 MB). Sıkıştırma middleware'i devrede; ayrıca
        // önbelleklenmemesi önemli — build her gece taze veri bekliyor.
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Slug'ı olmayan ürün/marketlere slug üretir. Gecelik build export'tan ÖNCE
 * çağırır — scrape her gün yeni ürün getiriyor ve slug'sız ürünün sayfası olmaz.
 */
export const backfillSlugs = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).json({ success: true, data: await ensureSlugs() });
    } catch (error) {
        next(error);
    }
};
