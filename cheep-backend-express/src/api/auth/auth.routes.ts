import { Router } from 'express';
import * as AuthController from './auth.controller.js'; // <-- .js uzantısı
import { authLimiter } from '../../middleware/rate-limit.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import { registerSchema, loginSchema } from './auth.schema.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Kullanıcı kimlik doğrulama işlemleri
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Yeni kullanıcı kaydı oluşturur
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 6 }
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Kullanıcı başarıyla oluşturuldu
 */
router.post('/register', authLimiter, validate(registerSchema), AuthController.register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Kullanıcı girişi yapar ve JWT token döndürür
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: test@cheep.com }
 *               password: { type: string, format: password, example: "••••••••" }
 *     responses:
 *       200:
 *         description: Başarılı giriş
 */
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh token ile yeni access token alır
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Yeni token ve refreshToken
 *       401:
 *         description: Geçersiz/süresi dolmuş refresh token
 */
router.post('/refresh', AuthController.refresh);

export default router;