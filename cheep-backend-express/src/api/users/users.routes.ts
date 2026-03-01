import { Router } from 'express';
import * as UserController from './users.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

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
router.post('/me/favorite-stores/:storeId', authenticate, UserController.addFavoriteStore);

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
router.delete('/me/favorite-stores/:storeId', authenticate, UserController.removeFavoriteStore);

export default router;

