import { Router } from 'express';
import * as UserController from './users.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateIdParam } from '../../middleware/validate-id.middleware.js';
import {
    accountDeletionLimiter,
    accountDeletionIpLimiter,
} from '../../middleware/rate-limit.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Kullanıcı yönetimi
 */

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Giriş yapmış kullanıcının bilgilerini getirir
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı bilgileri başarıyla alındı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 email:
 *                   type: string
 *                   example: "test@cheep.com"
 *                 name:
 *                   type: string
 *                   example: "Test Kullanıcı"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Yetkisiz erişim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Yetkilendirme başarısız. Token bulunamadı."
 */
router.get('/me', authenticate, UserController.getMe);

/**
 * @swagger
 * /api/v1/users/me:
 *   put:
 *     summary: Kullanıcı profilini günceller
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Yeni İsim"
 *     responses:
 *       200:
 *         description: Profil başarıyla güncellendi
 *       401:
 *         description: Yetkisiz erişim
 */
router.put('/me', authenticate, UserController.updateProfile);

/**
 * @swagger
 * /api/v1/users/me:
 *   delete:
 *     summary: Giriş yapmış kullanıcının hesabını ve tüm verilerini kalıcı olarak siler
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hesap ve tüm ilişkili veriler silindi
 *       401:
 *         description: Yetkisiz erişim
 */
router.delete('/me', authenticate, UserController.deleteMe);

/**
 * @swagger
 * /api/v1/users/account-deletion:
 *   post:
 *     summary: Uygulamasız hesap silme (web formu). E-posta + şifre ile doğrular ve siler.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Hesap ve tüm ilişkili veriler silindi
 *       400:
 *         description: E-posta veya şifre eksik
 *       401:
 *         description: Geçersiz e-posta veya şifre
 */
// Kimliksiz + parola dogrulayan + GERI DONUSSUZ silen uc. Login ile ayni
// iki katmanli brute-force korumasi sart: bunlar olmadan tek koruma 600
// istek/dk'lik genel kovaydi, yani tek hesaba saatte ~36.000 parola
// denemesi -- ayni denemenin /auth/login uzerinden siniri saatte 40.
router.post(
    '/account-deletion',
    accountDeletionIpLimiter,
    accountDeletionLimiter,
    UserController.requestAccountDeletion,
);

// ============================================
// FAVORITE STORES
// ============================================

/**
 * @swagger
 * /api/v1/users/me/favorite-stores:
 *   get:
 *     summary: Favori marketleri getir
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Favori marketler başarıyla alındı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       logo_url:
 *                         type: string
 *                       address:
 *                         type: string
 *       401:
 *         description: Yetkisiz erişim
 */
router.get('/me/favorite-stores', authenticate, UserController.getFavoriteStores);

/**
 * @swagger
 * /api/v1/users/me/favorite-stores/{storeId}:
 *   post:
 *     summary: Favori markete ekle
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Market favorilere eklendi
 *       400:
 *         description: Market zaten favorilerde
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Market bulunamadı
 */
router.post('/me/favorite-stores/:storeId', authenticate, validateIdParam('storeId'), UserController.addFavoriteStore);

/**
 * @swagger
 * /api/v1/users/me/favorite-stores/{storeId}:
 *   delete:
 *     summary: Favorilerden çıkar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Market favorilerden çıkarıldı
 *       400:
 *         description: Market favorilerde değil
 *       401:
 *         description: Yetkisiz erişim
 */
router.delete('/me/favorite-stores/:storeId', authenticate, validateIdParam('storeId'), UserController.removeFavoriteStore);

export default router;

