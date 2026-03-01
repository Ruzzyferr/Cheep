import { type Request, type Response, type NextFunction } from 'express';
import * as CompareEngine from '../../services/compare-engine.service.js';
import { prisma } from '../../utils/prisma.client.js';

/**
 * Alışveriş listesi karşılaştırma ve optimizasyon
 */
export const compareList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;
        const {
            maxStores,
            userLocation,
            favoriteStoreIds,
            includeMissingProducts,
        } = req.body;

        const result = await CompareEngine.compareShoppingList(
            parseInt(id),
            req.user.id,
            {
                maxStores: maxStores || 3,
                userLocation,
                favoriteStoreIds,
                includeMissingProducts,
            }
        );

        // Sadece last_compared_at güncelle (status'i değiştirme)
        await prisma.list.update({
            where: { id: parseInt(id) },
            data: {
                last_compared_at: new Date(),
            },
        });

        res.status(200).json({
            success: true,
            data: result,
            message: '✅ Liste karşılaştırıldı',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Seçilen rotayı kullan - Listeyi completed yap
 */
export const useRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;

        // Listeyi completed yap
        await prisma.list.update({
            where: { id: parseInt(id) },
            data: {
                status: 'completed',
                completed_at: new Date(),
            },
        });

        res.status(200).json({
            success: true,
            message: '✅ Liste tamamlandı ve geçmiş listelere taşındı',
        });
    } catch (error) {
        next(error);
    }
};
