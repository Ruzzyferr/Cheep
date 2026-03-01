import { type Request, type Response, type NextFunction } from 'express';
import * as FeedbackService from './feedback.service.js';

/**
 * Fiyat için feedback oluşturur
 */
export const createPriceFeedback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        const { store_price_id, is_accurate, suggested_price, comment } = req.body;

        const feedback = await FeedbackService.createPriceFeedback({
            user_id: req.user.id,
            store_price_id,
            is_accurate,
            suggested_price,
            comment,
        });

        res.status(201).json({
            success: true,
            data: feedback,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Kullanıcının verdiği tüm feedback'leri getirir
 */
export const getUserFeedbacks = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        const feedbacks = await FeedbackService.getUserFeedbacks(req.user.id);

        res.status(200).json({
            success: true,
            data: feedbacks,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Bir fiyatın tüm feedback'lerini getirir
 */
export const getPriceFeedbacks = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { storePriceId } = req.params;
        const feedbacks = await FeedbackService.getPriceFeedbacks(parseInt(storePriceId));

        res.status(200).json({
            success: true,
            data: feedbacks,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Feedback'i siler
 */
export const deleteFeedback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Kullanıcı bilgisi bulunamadı',
            });
            return;
        }

        const { feedbackId } = req.params;
        await FeedbackService.deleteFeedback(parseInt(feedbackId), req.user.id);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

/**
 * Fiyat doğruluk istatistiklerini getirir
 */
export const getPriceAccuracyStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { storePriceId } = req.params;
        const stats = await FeedbackService.getPriceAccuracyStats(parseInt(storePriceId));

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        next(error);
    }
};

