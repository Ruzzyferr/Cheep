import { Router } from 'express';
import * as AffiliatesController from './affiliates.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import { trackClickSchema } from './affiliates.schema.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Affiliates
 *   description: Markete git ve sepeti tamamla tıklama takibi ve yönlendirme
 */

/**
 * @swagger
 * /api/v1/affiliates/click:
 *   post:
 *     summary: Tıklamayı kaydeder ve açılacak mağaza URL'sini döndürür
 *     tags: [Affiliates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeId]
 *             properties:
 *               storeId: { type: integer }
 *               listId: { type: integer }
 *               productId: { type: integer }
 *               context: { type: string, enum: [cart, product, store] }
 *     responses:
 *       200:
 *         description: Açılacak URL ve mağaza bilgisi döner
 *       404:
 *         description: Mağaza bulunamadı
 */
router.post('/click', authenticate, validate(trackClickSchema), AffiliatesController.trackClick);

export default router;
