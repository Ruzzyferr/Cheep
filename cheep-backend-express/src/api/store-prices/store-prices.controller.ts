import { type Request, type Response, type NextFunction } from 'express';
import * as StorePriceService from './store-prices.service.js';
import logger from '../../utils/logger.js';

export const upsertStorePrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const storePrice = await StorePriceService.upsertStorePrice(req.body);
        res.status(200).json(storePrice);
    } catch (error) {
        next(error);
    }
};

export const bulkUpsertStorePrices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { prices } = req.body;
        logger.info(`[StorePriceController] /bulk-upsert isteği alındı. Ürün sayısı: ${prices.length}`);
        const results = await StorePriceService.bulkUpsertStorePrices(prices);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};