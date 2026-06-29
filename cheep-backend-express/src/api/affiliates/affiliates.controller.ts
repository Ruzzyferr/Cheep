import { type Request, type Response, type NextFunction } from 'express';
import * as AffiliatesService from './affiliates.service.js';

/**
 * Tıklama kaydı + açılacak mağaza URL'si.
 * Body: { storeId, listId?, productId?, context? }
 */
export const trackClick = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { storeId, listId, productId, context } = req.body;
        const result = await AffiliatesService.trackClick({
            userId: req.user!.id,
            storeId,
            listId,
            productId,
            context,
        });
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};
