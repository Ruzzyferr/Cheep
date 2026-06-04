/**
 * 🤖 LLM-based Store Price Import Controller
 * Market bazlı gruplama ile optimize edilmiş import.
 * Çekirdek mantık ../../services/ingest.service.ts içindedir (Kafka consumer ile paylaşılır).
 */

import { type Request, type Response, type NextFunction } from 'express';
import logger from '../../utils/logger.js';
import { processRawProducts, type RawProductInput } from '../../services/ingest.service.js';

/**
 * LLM ile ürün import et (market bazlı gruplama ile optimize edilmiş).
 */
export const importWithLLM = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { products, use_llm = true } = req.body as {
            products: RawProductInput[];
            use_llm?: boolean;
        };

        if (!Array.isArray(products) || products.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Ürün listesi boş veya geçersiz',
            });
            return;
        }

        const result = await processRawProducts(products, use_llm);

        res.status(200).json({
            success: true,
            data: result,
            message: `✅ ${result.saved} ürün başarıyla import edildi`,
        });
    } catch (error: any) {
        logger.error(`[LLMImport] Hata: ${error.message}`);
        next(error);
    }
};
