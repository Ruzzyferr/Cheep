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
 */
const sanitizeValue = (value: any, key?: string): any => {
    // Numeric field'ları (price, lat, lon, vs.) ve URL'leri sanitize'dan muaf tut
    const numericFields = ['price', 'lat', 'lon', 'confidence_score', 'quantity', 'budget'];
    const urlFields = ['image_url', 'logo_url', 'url', 'product_url'];
    // Text field'ları (ürün adı, marka, vs.) sanitize'dan muaf tut - database güvenli
    const textFields = ['name', 'brand', 'sku', 'store_sku', 'unit', 'email', 'address', 'slug', 'muadil_grup_id'];
    
    if (key && (numericFields.includes(key) || urlFields.includes(key) || textFields.includes(key))) {
        return value; // Bu field'ları olduğu gibi döndür
    }
    
    if (typeof value === 'string') {
        // XSS koruması: SADECE gerçekten tehlikeli karakterleri encode et
        // ' (apostrophe) ve / (slash) normal karakterler, encode ETME
        let sanitized = value
            .replace(/&/g, '&amp;')    // & → &amp;
            .replace(/</g, '&lt;')     // < → &lt;
            .replace(/>/g, '&gt;')     // > → &gt;
            .replace(/"/g, '&quot;')   // " → &quot;
            .replace(/\$/g, '&#36;');  // $ → &#36; (NoSQL injection koruması)
        
        // ' ve / karakterlerini ENCODE ETME - bunlar normal karakterler
        
        return sanitized;
    }
    
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, key));
    }
    
    if (value !== null && typeof value === 'object') {
        const sanitized: any = {};
        for (const objKey in value) {
            // Object key'lerinde $ karakterini kontrol et
            if (objKey.includes('$')) {
                continue; // Tehlikeli key'leri atla
            }
            sanitized[objKey] = sanitizeValue(value[objKey], objKey);
        }
        return sanitized;
    }
    
    return value;
};

/**
 * Request body, query ve params'ı sanitize eden middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
        req.body = sanitizeValue(req.body);
    }
    
    // req.query ve req.params read-only oldukları için in-place sanitize ediyoruz
    if (req.query) {
        for (const key in req.query) {
            if (Object.prototype.hasOwnProperty.call(req.query, key)) {
                (req.query as any)[key] = sanitizeValue(req.query[key], key);
            }
        }
    }
    
    if (req.params) {
        for (const key in req.params) {
            if (Object.prototype.hasOwnProperty.call(req.params, key)) {
                (req.params as any)[key] = sanitizeValue(req.params[key], key);
            }
        }
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

