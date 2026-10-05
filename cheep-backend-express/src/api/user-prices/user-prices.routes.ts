import { Router } from 'express';
import * as Controller from './user-prices.controller.js';
import { validate } from '../../schema/validation.middleware.js';
import { createUserPriceSchema } from './user-prices.schema.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { userPriceLimiter, userPriceDailyLimiter } from '../../middleware/rate-limit.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: UserPrices
 *   description: Kullanıcı fiyat bildirimleri (hukuken bize ait tek fiyat kaynağı)
 */

/**
 * @swagger
 * /api/v1/user-prices:
 *   post:
 *     summary: Rafta görülen fiyatı bildir
 *     tags: [UserPrices]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Bildirim kaydedildi }
 */
router.post('/', authenticate, userPriceDailyLimiter, userPriceLimiter, validate(createUserPriceSchema), Controller.create);

/**
 * @swagger
 * /api/v1/user-prices/mine:
 *   get:
 *     summary: Kendi bildirimlerim
 *     tags: [UserPrices]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/mine', authenticate, Controller.mine);

export default router;
