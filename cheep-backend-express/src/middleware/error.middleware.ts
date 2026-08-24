import { type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import logger from "../utils/logger.js";
import { AppError } from '../utils/app-error.js';

/**
 * Global Error Handler Middleware
 */
export const errorHandler = (
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    // Tam hata sadece loglara yazılır; HTTP yanıtında detay/stack sızdırılmaz.
    logger.error(error.stack || error.message || String(error));

    // Uygulama hataları (status taşıyan) — mesaj korunur.
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
            ...(error.code ? { code: error.code } : {}),
        });
    }

    // status taşıyan diğer hatalar (ör. assistant Object.assign(..., { status }))
    const anyErr = error as any;
    if (typeof anyErr?.statusCode === 'number' || typeof anyErr?.status === 'number') {
        const code = anyErr.statusCode ?? anyErr.status;
        return res.status(code).json({
            success: false,
            message: error.message || 'Hata',
            ...(anyErr.code ? { code: anyErr.code } : {}),
        });
    }

    // Prisma hataları — koda göre ayrıştır.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'Bu kayıt zaten mevcut',
            });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: 'Kayıt bulunamadı',
            });
        }
        return res.status(400).json({
            success: false,
            message: 'Database hatası',
        });
    }

    // Prisma validation hataları
    if (error instanceof Prisma.PrismaClientValidationError) {
        return res.status(400).json({
            success: false,
            message: 'Geçersiz veri',
            error: 'Gönderilen veri formatı hatalı',
        });
    }

    // JWT hataları
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Geçersiz token',
        });
    }

    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token süresi dolmuş',
        });
    }

    // Diğer hatalar — istemciye genel mesaj, detay loglarda.
    res.status(500).json({
        success: false,
        message: 'Sunucu hatası',
    });
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    res.status(404).json({
        success: false,
        message: `Route bulunamadı: ${req.method} ${req.path}`,
    });
};