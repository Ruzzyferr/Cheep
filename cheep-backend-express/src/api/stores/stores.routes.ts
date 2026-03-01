import { Router } from 'express';
import * as StoreController from './stores.controller.js';
import { validate } from '../../schema/validation.middleware.js';
import { createStoreSchema, updateStoreSchema } from './store.schema.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Stores
 *   description: Market yönetimi
 */

/**
 * @swagger
 * /api/v1/stores:
 *   get:
 *     summary: Tüm marketleri listeler
 *     tags: [Stores]
 *     responses:
 *       200:
 *         description: Market listesi başarıyla alındı
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Store'
 */
router.get('/', StoreController.getAllStores);

/**
 * @swagger
 * /api/v1/stores/{id}:
 *   get:
 *     summary: ID'ye göre market getirir
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Market başarıyla alındı
 *       404:
 *         description: Market bulunamadı
 */
router.get('/:id', StoreController.getStoreById);

/**
 * @swagger
 * /api/v1/stores:
 *   post:
 *     summary: Yeni bir market oluşturur
 *     tags: [Stores]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "BİM"
 *               logo_url:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/bim-logo.png"
 *               address:
 *                 type: string
 *                 example: "Beşiktaş, İstanbul"
 *               lat:
 *                 type: number
 *                 example: 41.0441
 *               lon:
 *                 type: number
 *                 example: 29.0021
 *     responses:
 *       201:
 *         description: Market başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Store'
 *       400:
 *         description: Geçersiz istek verisi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', validate(createStoreSchema), StoreController.createStore);

/**
 * @swagger
 * /api/v1/stores/{id}:
 *   put:
 *     summary: Marketi günceller
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               logo_url:
 *                 type: string
 *               address:
 *                 type: string
 *               lat:
 *                 type: number
 *               lon:
 *                 type: number
 *     responses:
 *       200:
 *         description: Market başarıyla güncellendi
 *       404:
 *         description: Market bulunamadı
 */
router.put('/:id', validate(updateStoreSchema), StoreController.updateStore);

/**
 * @swagger
 * /api/v1/stores/{id}:
 *   delete:
 *     summary: Marketi siler
 *     tags: [Stores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Market başarıyla silindi
 *       404:
 *         description: Market bulunamadı
 */
router.delete('/:id', StoreController.deleteStore);

export default router;