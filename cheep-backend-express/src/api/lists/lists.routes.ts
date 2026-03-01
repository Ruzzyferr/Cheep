import { Router } from 'express';
import * as ListController from './lists.controller.js';
import * as ListCompareController from './lists-compare.controller.js';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import {
    createListSchema,
    updateListSchema,
    addListItemSchema,
    updateListItemSchema,
} from '../../schema/list.schema.js';
import { compareListSchema } from '../../schema/compare.schema.js';
import { compareLimiter } from '../../middleware/rate-limit.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Lists
 *   description: Alışveriş listesi yönetimi
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     List:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *         name:
 *           type: string
 *           example: "Haftalık Alışveriş"
 *         is_template:
 *           type: boolean
 *           example: false
 *         budget:
 *           type: number
 *           example: 500.00
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     ListItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         list_id:
 *           type: integer
 *         product_id:
 *           type: integer
 *         quantity:
 *           type: number
 *           example: 2
 *         unit:
 *           type: string
 *           example: "adet"
 *         product:
 *           $ref: '#/components/schemas/Product'
 */

// ============================================
// LIST CRUD OPERATIONS
// ============================================

/**
 * @swagger
 * /api/v1/lists:
 *   get:
 *     summary: Kullanıcının tüm listelerini getir
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, all]
 *           default: all
 *         description: Liste durumu filtresi (active=aktif, completed=geçmiş, all=hepsi)
 *     responses:
 *       200:
 *         description: Listeler başarıyla alındı
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
 *                     $ref: '#/components/schemas/List'
 *       401:
 *         description: Yetkisiz erişim
 */
router.get('/', authenticate, ListController.getMyLists);

/**
 * @swagger
 * /api/v1/lists/{id}:
 *   get:
 *     summary: Liste detayını getir
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Liste ID
 *     responses:
 *       200:
 *         description: Liste detayı başarıyla alındı
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Liste bulunamadı
 */
router.get('/:id', authenticate, ListController.getListById);

/**
 * @swagger
 * /api/v1/lists:
 *   post:
 *     summary: Yeni liste oluştur
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
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
 *                 example: "Haftalık Alışveriş"
 *               is_template:
 *                 type: boolean
 *                 default: false
 *               budget:
 *                 type: number
 *                 example: 500.00
 *     responses:
 *       201:
 *         description: Liste başarıyla oluşturuldu
 *       400:
 *         description: Validation hatası
 *       401:
 *         description: Yetkisiz erişim
 */
router.post(
    '/',
    authenticate,
    validate(createListSchema),
    ListController.createList
);

/**
 * @swagger
 * /api/v1/lists/{id}:
 *   put:
 *     summary: Liste güncelle
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
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
 *               is_template:
 *                 type: boolean
 *               budget:
 *                 type: number
 *     responses:
 *       200:
 *         description: Liste güncellendi
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Liste bulunamadı
 */
router.put(
    '/:id',
    authenticate,
    validate(updateListSchema),
    ListController.updateList
);

/**
 * @swagger
 * /api/v1/lists/{id}:
 *   delete:
 *     summary: Liste sil
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste silindi
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Liste bulunamadı
 */
router.delete('/:id', authenticate, ListController.deleteList);

/**
 * @swagger
 * /api/v1/lists/{id}/statistics:
 *   get:
 *     summary: Liste istatistikleri
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: İstatistikler başarıyla alındı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     listId:
 *                       type: integer
 *                     listName:
 *                       type: string
 *                     totalItems:
 *                       type: integer
 *                     itemsWithPrices:
 *                       type: integer
 *                     estimatedMinPrice:
 *                       type: string
 *                       example: "450.50"
 *                     estimatedMaxPrice:
 *                       type: string
 *                       example: "550.75"
 *                     potentialSavings:
 *                       type: string
 *                       example: "100.25"
 */
router.get('/:id/statistics', authenticate, ListController.getListStatistics);

// ============================================
// TEMPLATES
// ============================================

/**
 * @swagger
 * /api/v1/lists/templates/all:
 *   get:
 *     summary: Tüm şablonları getir (public)
 *     tags: [Lists]
 *     responses:
 *       200:
 *         description: Şablonlar başarıyla alındı
 */
router.get('/templates/all', ListController.getTemplates);

/**
 * @swagger
 * /api/v1/lists/templates/{templateId}/create:
 *   post:
 *     summary: Şablondan liste oluştur
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Yeni Liste Adı"
 *     responses:
 *       201:
 *         description: Şablondan liste oluşturuldu
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Şablon bulunamadı
 */
router.post(
    '/templates/:templateId/create',
    authenticate,
    ListController.createFromTemplate
);

// ============================================
// COMPLETED LIST IMPORT/REUSE
// ============================================

/**
 * @swagger
 * /api/v1/lists/completed/{completedListId}/import-to-existing:
 *   post:
 *     summary: Geçmiş listeden MEVCUT LİSTEYE EKLE (Merge)
 *     tags: [Lists]
 *     description: |
 *       Geçmiş listedeki ürünleri mevcut bir listeye ekler.
 *       Duplicate ürünler atlanır.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: completedListId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetListId
 *             properties:
 *               targetListId:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       200:
 *         description: Ürünler başarıyla eklendi
 *       401:
 *         description: Yetkisiz erişim
 */
router.post('/completed/:completedListId/import-to-existing', authenticate, ListController.importFromCompletedList);

/**
 * @swagger
 * /api/v1/lists/completed/{completedListId}/create-new:
 *   post:
 *     summary: Geçmiş listeden YENİ LİSTE OLUŞTUR (Replace)
 *     tags: [Lists]
 *     description: |
 *       Geçmiş listeden yeni bir aktif liste oluşturur.
 *       Eğer oldActiveListId belirtilirse, o liste SİLİNİR!
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: completedListId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldActiveListId:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       201:
 *         description: Yeni liste oluşturuldu
 *       401:
 *         description: Yetkisiz erişim
 */
router.post('/completed/:completedListId/create-new', authenticate, ListController.replaceWithCompletedList);

// ============================================
// LIST ITEMS
// ============================================

/**
 * @swagger
 * /api/v1/lists/{id}/items:
 *   post:
 *     summary: Listeye ürün ekle
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
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
 *             required:
 *               - product_id
 *             properties:
 *               product_id:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: number
 *                 example: 2
 *                 default: 1
 *               unit:
 *                 type: string
 *                 enum: [adet, kg, g, l, ml, cl, paket, kutu]
 *                 default: "adet"
 *     responses:
 *       201:
 *         description: Ürün listeye eklendi
 *       400:
 *         description: Validation hatası
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Liste veya ürün bulunamadı
 */
router.post(
    '/:id/items',
    authenticate,
    validate(addListItemSchema),
    ListController.addItemToList
);

/**
 * @swagger
 * /api/v1/lists/items/{itemId}:
 *   put:
 *     summary: Liste item'ı güncelle
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
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
 *               quantity:
 *                 type: number
 *                 example: 3
 *               unit:
 *                 type: string
 *                 enum: [adet, kg, g, l, ml, cl, paket, kutu]
 *     responses:
 *       200:
 *         description: Item güncellendi
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Item bulunamadı
 */
router.put(
    '/items/:itemId',
    authenticate,
    validate(updateListItemSchema),
    ListController.updateListItem
);

/**
 * @swagger
 * /api/v1/lists/items/{itemId}:
 *   delete:
 *     summary: Listeden ürün çıkar
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ürün listeden çıkarıldı
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Item bulunamadı
 */
router.delete('/:id/items/:itemId', authenticate, ListController.removeItemFromList);

/**
 * @swagger
 * /api/v1/lists/{id}/clear:
 *   delete:
 *     summary: Listedeki tüm ürünleri sil
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste temizlendi
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Liste bulunamadı
 */
router.delete('/:id/clear', authenticate, ListController.clearList);

// ============================================
// COMPARE ENGINE
// ============================================

/**
 * @swagger
 * /api/v1/lists/{id}/compare:
 *   post:
 *     summary: Alışveriş listesi karşılaştırma ve optimizasyon
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Listedeki ürünler için en uygun alışveriş stratejilerini hesaplar:
 *       - Single store: Tek marketten tüm alışveriş
 *       - Multi store: Birden fazla marketten en ucuz kombinasyon
 *       - Rota optimizasyonu ve mesafe hesaplama
 *       - Muadil ürün önerileri
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Liste ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxStores:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 default: 3
 *                 description: Maksimum market sayısı
 *               userLocation:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                     example: 38.4192
 *                   lon:
 *                     type: number
 *                     example: 27.1287
 *                 description: Kullanıcı konumu (mesafe hesabı için)
 *               favoriteStoreIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 3]
 *                 description: Favori market ID'leri
 *               includeMissingProducts:
 *                 type: boolean
 *                 default: true
 *                 description: Eksik ürünleri göster
 *           example:
 *             maxStores: 3
 *             userLocation:
 *               lat: 38.4192
 *               lon: 27.1287
 *             favoriteStoreIds: [1, 3]
 *             includeMissingProducts: true
 *     responses:
 *       200:
 *         description: Karşılaştırma başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     listId:
 *                       type: integer
 *                     listName:
 *                       type: string
 *                     totalItems:
 *                       type: integer
 *                     budget:
 *                       type: number
 *                     strategies:
 *                       type: array
 *                       description: Tüm stratejiler (skorlanmış ve sıralanmış)
 *                     alternatives:
 *                       type: array
 *                       description: Muadil ürün önerileri
 *                     summary:
 *                       type: object
 *                       properties:
 *                         bestSingleStore:
 *                           type: object
 *                           description: En iyi tek market stratejisi
 *                         bestMultiStore:
 *                           type: object
 *                           description: En iyi çoklu market stratejisi
 *                         cheapestOption:
 *                           type: object
 *                           description: En ucuz seçenek
 *                         closestOption:
 *                           type: object
 *                           description: En yakın seçenek
 *                         maxSavings:
 *                           type: number
 *                           description: Maksimum tasarruf potansiyeli
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Liste bulunamadı
 */
router.post(
    '/:id/compare',
    authenticate,
    compareLimiter,
    validate(compareListSchema),
    ListCompareController.compareList
);

/**
 * @swagger
 * /api/v1/lists/{id}/use-route:
 *   post:
 *     summary: Seçilen rotayı kullan - Listeyi tamamla
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Kullanıcı bir rotayı seçtiğinde listeyi "completed" durumuna alır.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Liste ID
 *     responses:
 *       200:
 *         description: Liste tamamlandı
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Liste bulunamadı
 */
router.post(
    '/:id/use-route',
    authenticate,
    ListCompareController.useRoute
);

export default router;

