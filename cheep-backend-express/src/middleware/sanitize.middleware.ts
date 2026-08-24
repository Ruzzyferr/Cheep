import { type Request, type Response, type NextFunction } from 'express';

/**
 * Girdi temizleme middleware'i.
 *
 * KAPSAM BİLEREK DAR: yalnızca `$` içeren nesne anahtarları elenir. Metin
 * değerlerine DOKUNULMAZ.
 *
 * Neden bu kadar az şey yapıyor:
 *  - SQL injection'a karşı koruma Prisma'nın parametreli sorgularında ve
 *    `Prisma.sql` şablonlarında; girdi kırpmakla sağlanmıyor.
 *  - Girdi doğrulaması Joi şemalarında (`stripUnknown` ile mass-assignment
 *    korumalı).
 *  - XSS, ÇIKTI encode'unun işidir; girdide HTML-entity encode etmek saklanan
 *    metni kalıcı olarak bozar ("Çay & Kahve" → "Çay &amp; Kahve"). Bu daha
 *    önce yaşandı ve geri alındı.
 *
 * ⚠️ BURAYA "DAHA GÜÇLÜ" BİR TEMİZLEYİCİ EKLEMEYİN. Bu dosyada bir zamanlar
 * `sanitizeNoSQL` (her metinden `$` ve `.` karakterlerini silen) ve
 * `sanitizeHTML` (her metni HTML-entity'ye çeviren) vardı. İkisi de hiçbir
 * yerde kullanılmıyordu ama zincire eklenmeleri bir satırlık işti ve
 * eklendikleri anda sessizce şunları bozacaklardı:
 *   - e-posta adresleri:  "ali@site.com" → "ali@sitecom"
 *   - ondalıklı fiyatlar: "12.50"        → "1250"
 *   - ürün adları:        "Çay & Kahve"  → "Çay &amp; Kahve"
 * Uygulama PostgreSQL kullanıyor; NoSQL operatör kaçışı zaten konu dışı.
 * Bu yüzden ikisi de silindi.
 */

/** `$` içeren nesne anahtarlarını eleyerek özyinelemeli kopya üretir. */
const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
        // Metni olduğu gibi koru (mutasyon yok).
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item));
    }

    if (value !== null && typeof value === 'object') {
        const sanitized: any = {};
        for (const objKey in value) {
            if (objKey.includes('$')) {
                continue; // Tehlikeli key'leri atla
            }
            sanitized[objKey] = sanitizeValue(value[objKey]);
        }
        return sanitized;
    }

    return value;
};

/** Request body'sini temizler. Query ve params'a dokunulmaz (Joi doğruluyor). */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
        req.body = sanitizeValue(req.body);
    }

    next();
};
