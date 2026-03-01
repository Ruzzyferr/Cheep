import { Router } from 'express';
import * as FeedbackController from './feedback.controller.js';
import { validate } from '../../schema/validation.middleware.js';
import { createPriceFeedbackSchema } from './feedback.schema.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { feedbackLimiter } from '../../middleware/rate-limit.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: Fiyat geri bildirimi yönetimi
 */

/**
 * @swagger
 * /api/v1/feedback:
 *   post:
 *     summary: Fiyat için feedback oluşturur
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - store_price_id
 *               - is_accurate
 *             properties:
 *               store_price_id:
 *                 type: integer
 *                 example: 1
 *               is_accurate:
 *                 type: boolean
 *                 example: false
 *               suggested_price:
 *                 type: number
 *                 example: 25.99
 *               comment:
 *                 type: string
 *                 example: "Fiyat daha yüksek"
 *     responses:
 *       201:
 *         description: Feedback başarıyla oluşturuldu
 *       401:
 *         description: Yetkisiz erişim
 */
router.post('/', authenticate, feedbackLimiter, validate(createPriceFeedbackSchema), FeedbackController.createPriceFeedback);

/**
 * @swagger
 * /api/v1/feedback/my:
 *   get:
 *     summary: Kullanıcının verdiği tüm feedback'leri getirir
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback'ler başarıyla alındı
 *       401:
 *         description: Yetkisiz erişim
 */
router.get('/my', authenticate, FeedbackController.getUserFeedbacks);

/**
 * @swagger
 * /api/v1/feedback/price/{storePriceId}:
 *   get:
 *     summary: Bir fiyatın tüm feedback'lerini getirir
 *     tags: [Feedback]
 *     parameters:
 *       - in: path
 *         name: storePriceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Feedback'ler başarıyla alındı
 */
router.get('/price/:storePriceId', FeedbackController.getPriceFeedbacks);

/**
 * @swagger
 * /api/v1/feedback/price/{storePriceId}/stats:
 *   get:
 *     summary: Fiyat doğruluk istatistiklerini getirir
 *     tags: [Feedback]
 *     parameters:
 *       - in: path
 *         name: storePriceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: İstatistikler başarıyla alındı
 */
router.get('/price/:storePriceId/stats', FeedbackController.getPriceAccuracyStats);

/**
 * @swagger
 * /api/v1/feedback/{feedbackId}:
 *   delete:
 *     summary: Feedback'i siler
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedbackId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Feedback başarıyla silindi
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Feedback bulunamadı
 */
router.delete('/:feedbackId', authenticate, FeedbackController.deleteFeedback);

export default router;

