import express, { type RequestHandler } from 'express';

/**
 * Gövde boyutu limitleri.
 *
 * Eskiden `express.json({ limit: '50mb' })` TÜM uçlara uygulanıyordu. Kimliği
 * doğrulanmamış biri `/auth/login`'e 50 MB gönderip 2 GB'lık makinenin belleğini
 * tüketebilirdi; birkaç eşzamanlı istek yeterdi. Gerçekten büyük gövde isteyen
 * tek yer scraper'ın toplu yüklemeleri, o yüzden limit yola göre seçiliyor.
 */

/** Scraper'ın toplu yükleme uçları — yalnızca bunlar geniş gövde alabilir. */
export const BULK_INGEST_PATHS = [
    '/api/v1/store-prices/bulk-upsert',
    '/api/v1/store-branches/bulk-upsert',
];

export const BULK_LIMIT = '50mb';
export const STANDARD_LIMIT = '1mb';

export function jsonBodyParser(): RequestHandler {
    const bulk = express.json({ limit: BULK_LIMIT });
    const standard = express.json({ limit: STANDARD_LIMIT });

    return (req, res, next) =>
        (BULK_INGEST_PATHS.includes(req.path) ? bulk : standard)(req, res, next);
}
