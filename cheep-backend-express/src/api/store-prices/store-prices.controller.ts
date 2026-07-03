import { type Request, type Response, type NextFunction } from 'express';
import * as StorePriceService from './store-prices.service.js';
import logger from '../../utils/logger.js';

export const upsertStorePrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const countryId = req.country?.id;
        const storePrice = await StorePriceService.upsertStorePrice(req.body, countryId);
        res.status(200).json(storePrice);
    } catch (error) {
        next(error);
    }
};

export const bulkUpsertStorePrices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { prices } = req.body;
        const countryId = req.country?.id;
        logger.info(`[StorePriceController] /bulk-upsert isteği alındı. Ürün sayısı: ${prices.length}`);
        const results = await StorePriceService.bulkUpsertStorePrices(prices, countryId);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};

// Bayat fiyat/ürün süpürmesi (kaldırılan ürünleri temizler). Ingest-key korumalı.
export const pruneStalePrices = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const countryId = req.country?.id;
        const ttlDays = Number(req.body?.ttl_days) > 0 ? Number(req.body.ttl_days) : 21;
        const result = await StorePriceService.pruneStalePrices(countryId, ttlDays);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};