import rateLimit from 'express-rate-limit';

/**
 * Genel API rate limiting
 * Development: 1 dakikada 10000 istek (scraper için)
 * Production: 15 dakikada 100 istek
 */
export const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    max: process.env.NODE_ENV === 'production' ? 100 : 10000, // Dev: çok yüksek, Prod: 100
    message: {
        success: false,
        message: 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.',
    },
    standardHeaders: true, // `RateLimit-*` header'larını döndür
    legacyHeaders: false, // `X-RateLimit-*` header'larını devre dışı bırak
    skip: (req) => {
        // Development modunda scraper endpoint'lerini atla
        return process.env.NODE_ENV !== 'production';
    },
});

/**
 * Auth endpoint'leri için strict rate limiting
 * 15 dakikada maksimum 5 istek
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 5, // maksimum 5 istek
    message: {
        success: false,
        message: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Başarılı istekleri de say
});

/**
 * Feedback oluşturma için rate limiting
 * 1 dakikada maksimum 3 istek
 */
export const feedbackLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    max: 3, // maksimum 3 istek
    message: {
        success: false,
        message: 'Çok fazla feedback gönderdiniz. Lütfen 1 dakika bekleyin.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Compare endpoint için rate limiting
 * 1 dakikada maksimum 10 istek
 */
export const compareLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    max: 10, // maksimum 10 istek
    message: {
        success: false,
        message: 'Çok fazla karşılaştırma isteği gönderdiniz. Lütfen 1 dakika bekleyin.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

