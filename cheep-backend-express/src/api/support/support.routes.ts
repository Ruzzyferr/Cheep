import { Router } from 'express';
import * as SupportController from './support.controller.js';
import { optionalAuthenticate } from '../../middleware/optional-auth.middleware.js';
import { contactLimiter } from '../../middleware/rate-limit.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import { contactSchema } from './support.schema.js';

const router = Router();

/**
 * @swagger
 * /api/v1/support/contact:
 *   post:
 *     summary: Destek mesajı gönderir (giriş zorunlu değil)
 *     tags: [Support]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, message]
 *             properties:
 *               email: { type: string, format: email }
 *               message: { type: string, minLength: 10, maxLength: 2000 }
 *               topic: { type: string, enum: [bug, suggestion, price, account, other] }
 *               app_version: { type: string }
 *               platform: { type: string }
 *               os_version: { type: string }
 *               locale: { type: string }
 *               country_code: { type: string }
 *     responses:
 *       201:
 *         description: Mesaj alındı
 *       429:
 *         description: Çok fazla mesaj
 */
router.post(
    '/contact',
    optionalAuthenticate,
    contactLimiter,
    validate(contactSchema),
    SupportController.contact
);

export default router;
