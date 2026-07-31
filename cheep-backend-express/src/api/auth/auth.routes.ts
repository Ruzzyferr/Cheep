import { Router } from 'express';
import * as AuthController from './auth.controller.js'; // <-- .js uzantısı
import {
    registerLimiter,
    loginIpLimiter,
    loginAccountLimiter,
    verifyLimiter,
    changePasswordLimiter,
} from '../../middleware/rate-limit.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { registerSchema, loginSchema, changePasswordSchema, verifyEmailSchema } from './auth.schema.js';

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
router.post('/register', registerLimiter, validate(registerSchema), AuthController.register);

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
router.post('/login', loginIpLimiter, loginAccountLimiter, validate(loginSchema), AuthController.login);

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

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: 6 haneli kod ile e-posta adresini doğrular
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: E-posta doğrulandı
 *       400:
 *         description: Kod hatalı veya süresi dolmuş
 */
router.post(
    '/verify-email',
    authenticate,
    verifyLimiter,
    validate(verifyEmailSchema),
    AuthController.verifyEmail
);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: E-posta doğrulama kodunu yeniden gönderir
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kod yeniden gönderildi
 */
router.post(
    '/resend-verification',
    authenticate,
    verifyLimiter,
    AuthController.resendVerification
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Çıkış yapar ve tüm refresh token'ları geçersiz kılar
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Çıkış yapıldı
 *       401:
 *         description: Yetkisiz erişim
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Parola değiştirir; eski oturumları sonlandırır ve yeni token çifti döner
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password }
 *               newPassword: { type: string, format: password, minLength: 6 }
 *     responses:
 *       200:
 *         description: Parola değiştirildi; yeni token ve refreshToken
 *       401:
 *         description: Mevcut şifre hatalı veya yetkisiz
 */
router.post(
    '/change-password',
    authenticate,
    changePasswordLimiter,
    validate(changePasswordSchema),
    AuthController.changePassword
);

export default router;