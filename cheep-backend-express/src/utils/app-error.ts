/**
 * AppError
 *
 * HTTP durum kodu taşıyan uygulama hatası. Servisler kullanıcıya dönük
 * hataları (bulunamadı, yetki yok, çakışma, hatalı girdi) bu tip ile fırlatır;
 * global error handler `statusCode`'u onurlandırır ve mesajı (Türkçe) korur.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code?: string;

    constructor(message: string, statusCode = 500, code?: string) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        // V8 stack trace temizliği
        Error.captureStackTrace?.(this, AppError);
    }
}

/** 404 — kaynak bulunamadı. */
export const notFound = (message: string) => new AppError(message, 404, 'NOT_FOUND');

/** 403 — sahiplik/yetki ihlali. */
export const forbidden = (message: string) => new AppError(message, 403, 'FORBIDDEN');

/** 409 — çakışma/duplicate. */
export const conflict = (message: string) => new AppError(message, 409, 'CONFLICT');

/** 400 — geçersiz girdi. */
export const badRequest = (message: string) => new AppError(message, 400, 'BAD_REQUEST');
