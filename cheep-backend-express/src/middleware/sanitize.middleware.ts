import { type Request, type Response, type NextFunction } from 'express';

/**
 * Input sanitization middleware
 * XSS ve NoSQL Injection saldırılarına karşı koruma sağlar
 */

/**
 * HTML karakterlerini escape eden helper
 */
const escapeHTML = (str: string): string => {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };
    return str.replace(/[&<>"'/]/g, (char) => map[char]);
};

/**
 * Recursive sanitization helper
 *
 * NOT: String değerleri ARTIK HTML-entity ile encode ETMİYORUZ — bu, saklanan
 * metni bozuyordu (ör. "Çay & Kahve" → "Çay &amp; Kahve"). Girdi doğrulaması
 * Joi ile yapılır; çıktı encode'u (XSS) sunum katmanının sorumluluğundadır.
 * Burada yalnızca NoSQL-injection için $ ile başlayan object key'leri elenir.
 */
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
            // Object key'lerinde $ karakterini kontrol et (NoSQL injection koruması)
            if (objKey.includes('$')) {
                continue; // Tehlikeli key'leri atla
            }
            sanitized[objKey] = sanitizeValue(value[objKey]);
        }
        return sanitized;
    }

    return value;
};

/**
 * Request body, query ve params'ı sanitize eden middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    // Sadece $ ile başlayan tehlikeli object key'lerini eler; metin değerlerini
    // BOZMAZ (HTML-entity encode yapılmaz). Joi validation asıl korumayı sağlar.
    if (req.body) {
        req.body = sanitizeValue(req.body);
    }

    next();
};

/**
 * Sadece HTML escape yapan hafif sanitization middleware
 * (Rate limiting'e tabi endpoint'ler için)
 */
export const sanitizeHTML = (req: Request, res: Response, next: NextFunction) => {
    const sanitizeHTMLOnly = (value: any): any => {
        if (typeof value === 'string') {
            return escapeHTML(value);
        }
        
        if (Array.isArray(value)) {
            return value.map(sanitizeHTMLOnly);
        }
        
        if (value !== null && typeof value === 'object') {
            const sanitized: any = {};
            for (const key in value) {
                sanitized[key] = sanitizeHTMLOnly(value[key]);
            }
            return sanitized;
        }
        
        return value;
    };
    
    if (req.body) {
        req.body = sanitizeHTMLOnly(req.body);
    }
    
    next();
};

/**
 * Tehlikeli karakterleri temizleyen middleware
 * (SQL/NoSQL injection koruması)
 */
export const sanitizeNoSQL = (req: Request, res: Response, next: NextFunction) => {
    const removeNoSQLChars = (value: any): any => {
        if (typeof value === 'string') {
            // $ ve . karakterlerini kaldır
            return value.replace(/[$\.]/g, '');
        }
        
        if (Array.isArray(value)) {
            return value.map(removeNoSQLChars);
        }
        
        if (value !== null && typeof value === 'object') {
            const sanitized: any = {};
            for (const key in value) {
                // Key'lerde $ ve . varsa atla
                if (key.includes('$') || key.includes('.')) {
                    continue;
                }
                sanitized[key] = removeNoSQLChars(value[key]);
            }
            return sanitized;
        }
        
        return value;
    };
    
    if (req.body) {
        req.body = removeNoSQLChars(req.body);
    }
    
    // req.query read-only olduğu için in-place sanitize
    if (req.query) {
        for (const key in req.query) {
            if (Object.prototype.hasOwnProperty.call(req.query, key)) {
                (req.query as any)[key] = removeNoSQLChars(req.query[key]);
            }
        }
    }
    
    next();
};

