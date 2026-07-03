import { type Request, type Response, type NextFunction } from 'express';
import * as StoreBranchService from './store-branches.service.js';
import logger from '../../utils/logger.js';

export const bulkUpsertStoreBranches = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { branches } = req.body;
        const countryId = req.country?.id;
        logger.info(`[StoreBranchController] /bulk-upsert isteği alındı. Şube sayısı: ${branches.length}`);
        const results = await StoreBranchService.bulkUpsertStoreBranches(branches, countryId);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
};
