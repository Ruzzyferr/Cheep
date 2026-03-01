import { type Request, type Response, type NextFunction } from 'express';
import logger from "../utils/logger.js";

/**
 * Global Error Handler Middleware
 */
export const errorHandler = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('❌ Error:', error);

    logger.error(error);

    // Prisma hataları
    if (error.name === 'PrismaClientKnownRequestError') {
        return res.status(400).json({
            success: false,
            message: 'Database hatası',
            error: error.message,
        });
    }

    // Prisma validation hataları
    if (error.name === 'PrismaClientValidationError') {
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

    // Diğer hatalar
    res.status(500).json({
        success: false,
        message: error.message || 'Sunucu hatası',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    res.status(404).json({
        success: false,
        message: `Route bulunamadı: ${req.method} ${req.path}`,
    });
};