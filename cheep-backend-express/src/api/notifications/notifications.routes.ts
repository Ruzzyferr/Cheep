import { Router } from 'express';
import * as NotificationsController from './notifications.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireIngestKey } from '../../middleware/ingest-auth.middleware.js';
import { validateIdParam } from '../../middleware/validate-id.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Kullanıcının fiyat düşüşü bildirimleri
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Bildirim listesi }
 */
router.get('/', authenticate, NotificationsController.list);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Okunmamış bildirim sayısı (zil rozetinin kaynağı)
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Sayı }
 */
router.get('/unread-count', authenticate, NotificationsController.unreadCount);

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   post:
 *     summary: Tüm bildirimleri okundu işaretler
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Güncellenen sayı }
 */
router.post('/read-all', authenticate, NotificationsController.markAllRead);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   post:
 *     summary: Tek bildirimi okundu işaretler
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Güncellendi mi }
 */
router.post('/:id/read', authenticate, validateIdParam('id'), NotificationsController.markRead);

/**
 * @swagger
 * /api/v1/notifications/detect:
 *   post:
 *     summary: Günlük fiyat düşüşü tespitini çalıştırır (ingest anahtarı gerekir)
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Tespit özeti }
 */
router.post('/detect', requireIngestKey, NotificationsController.runDetection);

export default router;
