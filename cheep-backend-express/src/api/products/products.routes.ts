import { Router } from 'express';
import * as ProductController from './products.controller.js';
import { validate } from '../../schema/validation.middleware.js';
import {
    createProductSchema,
    updateProductSchema,
    getProductsQuerySchema,
} from './product.schema.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "cm3abc123"
 *         name:
 *           type: string
 *           example: "Pınar Süt 1L"
 *         brand:
 *           type: string
 *           example: "Pınar"
 *         barcode:
 *           type: string
 *           example: "8690572000001"
 *         image_url:
 *           type: string
 *           example: "https://example.com/pinar-sut.jpg"
 *         category_id:
 *           type: string
 *           example: "cm3cat123"
 *         muadil_grup_id:
 *           type: string
 *           example: "sut-1l-tam-yag"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     ProductWithPrices:
 *       allOf:
 *         - $ref: '#/components/schemas/Product'
 *         - type: object
 *           properties:
 *             category:
 *               $ref: '#/components/schemas/Category'
 *             store_prices:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StorePrice'
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         icon_url:
 *           type: string
 *     StorePrice:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         store_id:
 *           type: string
 *         product_id:
 *           type: string
 *         price:
 *           type: number
 *           example: 45.50
 *         unit:
 *           type: string
 *           example: "adet"
 *         last_updated_at:
 *           type: string
 *           format: date-time
 *         store:
 *           $ref: '#/components/schemas/Store'
 *     Store:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Migros"
 *         logo_url:
 *           type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 */

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Ürün yönetimi ve fiyat karşılaştırma
 */

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Tüm ürünleri listeler (filtreleme ve pagination ile)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *         description: Kategori ID'sine göre filtrele
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Marka ismine göre filtrele
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Ürün adı, marka veya barkod ile arama
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 500
 *         description: Sayfa başına ürün sayısı max 500 default 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Başlangıç offset'i
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductWithPrices'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 */
router.get(
    '/',
    validate(getProductsQuerySchema, 'query'),
    ProductController.getAllProducts
);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: ID'ye göre ürün getirir (fiyatlarla birlikte)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ürün ID
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductWithPrices'
 *       404:
 *         description: Ürün bulunamadı
 */
router.get('/:id', ProductController.getProductById);

/**
 * @swagger
 * /api/v1/products/barcode/{barcode}:
 *   get:
 *     summary: Barkoda göre ürün getirir
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: barcode
 *         required: true
 *         schema:
 *           type: string
 *         description: Ürün barkodu
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductWithPrices'
 *       404:
 *         description: Ürün bulunamadı
 */
router.get('/barcode/:barcode', ProductController.getProductByBarcode);

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Yeni ürün oluşturur
 *     tags: [Products]
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
 *                 minLength: 2
 *                 maxLength: 255
 *                 example: "Pınar Süt 1L"
 *               brand:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Pınar"
 *               barcode:
 *                 type: string
 *                 maxLength: 50
 *                 example: "8690572000001"
 *               image_url:
 *                 type: string
 *                 format: uri
 *               category_id:
 *                 type: string
 *               muadil_grup_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ürün başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    '/',
    validate(createProductSchema),
    ProductController.createProduct
);

/**
 * @swagger
 * /api/v1/products/upsert:
 *   post:
 *     summary: Ürünü oluşturur veya günceller (barkoda göre)
 *     tags: [Products]
 *     description: Eğer barkod mevcutsa ürünü günceller, yoksa yeni ürün oluşturur
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
 *               brand:
 *                 type: string
 *               barcode:
 *                 type: string
 *               image_url:
 *                 type: string
 *               category_id:
 *                 type: string
 *               muadil_grup_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ürün başarıyla upsert edildi
 *       400:
 *         description: Validation hatası
 */
router.post(
    '/upsert',
    validate(createProductSchema),
    ProductController.upsertProduct
);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   put:
 *     summary: Ürünü günceller
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               brand:
 *                 type: string
 *               barcode:
 *                 type: string
 *               image_url:
 *                 type: string
 *               category_id:
 *                 type: string
 *               muadil_grup_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ürün başarıyla güncellendi
 *       404:
 *         description: Ürün bulunamadı
 */
router.put(
    '/:id',
    validate(updateProductSchema),
    ProductController.updateProduct
);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   delete:
 *     summary: Ürünü siler
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Ürün başarıyla silindi
 *       404:
 *         description: Ürün bulunamadı
 */
router.delete('/:id', ProductController.deleteProduct);

/**
 * @swagger
 * /api/v1/products/{id}/prices:
 *   get:
 *     summary: Ürünün tüm marketlerdeki fiyatlarını getirir
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StorePrice'
 */
router.get('/:id/prices', ProductController.getProductPrices);

/**
 * @swagger
 * /api/v1/products/{id}/compare:
 *   get:
 *     summary: Ürünün fiyat karşılaştırmasını yapar
 *     tags: [Products]
 *     description: En ucuz, en pahalı ve ortalama fiyat bilgilerini döndürür
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     brand:
 *                       type: string
 *                     image_url:
 *                       type: string
 *                 prices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       store:
 *                         $ref: '#/components/schemas/Store'
 *                       price:
 *                         type: number
 *                       unit:
 *                         type: string
 *                       last_updated_at:
 *                         type: string
 *                         format: date-time
 *                 cheapest:
 *                   type: object
 *                   properties:
 *                     store:
 *                       $ref: '#/components/schemas/Store'
 *                     price:
 *                       type: number
 *                 mostExpensive:
 *                   type: object
 *                 averagePrice:
 *                   type: number
 *                   example: 44.30
 *                 priceDifference:
 *                   type: number
 *                   example: 3.55
 *                 savingsPercentage:
 *                   type: string
 *                   example: "7.45%"
 */
router.get('/:id/compare', ProductController.compareProductPrices);

/**
 * @swagger
 * /api/v1/products/find-or-create:
 *   post:
 *     summary: Ürünü bulur veya oluşturur (fuzzy matching)
 *     tags: [Products]
 *     description: |
 *       Akıllı ürün eşleştirme. Benzer bir ürün varsa onu döndürür,
 *       yoksa yeni ürün oluşturur. Barkod olmayan ürünler için idealdir.
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
 *                 example: "Tikveşli %18 Yağlı Krema 200 Ml"
 *               brand:
 *                 type: string
 *                 example: "Tikveşli"
 *               quantity:
 *                 type: number
 *                 example: 200
 *               unit:
 *                 type: string
 *                 example: "ml"
 *               category_id:
 *                 type: string
 *               image_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mevcut ürün bulundu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *                 isNew:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Mevcut ürün eşleştirildi"
 *       201:
 *         description: Yeni ürün oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *                 isNew:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Yeni ürün oluşturuldu"
 */
router.post(
    '/find-or-create',
    validate(createProductSchema),
    ProductController.findOrCreateProduct
);

/**
 * @swagger
 * /api/v1/products/debug/similar:
 *   get:
 *     summary: Benzer ürünleri gösterir (debugging)
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         example: "Tikveşli Krema"
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         example: "Tikveşli"
 *     responses:
 *       200:
 *         description: Benzer ürünler listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   brand:
 *                     type: string
 *                   similarity:
 *                     type: string
 *                     example: "92.50%"
 *                   matchReason:
 *                     type: string
 *                     example: "high-confidence"
 */
router.get('/debug/similar', ProductController.debugSimilarProducts);

/**
 * @swagger
 * /api/v1/products/merge:
 *   post:
 *     summary: İki ürünü birleştirir
 *     tags: [Products]
 *     description: |
 *       Source ürünün tüm fiyat ve liste kayıtlarını target ürüne taşır,
 *       ardından source ürünü siler.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceProductId
 *               - targetProductId
 *             properties:
 *               sourceProductId:
 *                 type: string
 *                 description: Silinecek ürün ID
 *               targetProductId:
 *                 type: string
 *                 description: Hedef ürün ID
 *     responses:
 *       200:
 *         description: Ürünler başarıyla birleştirildi
 */
router.post('/merge', ProductController.mergeProducts);

/**
 * @swagger
 * /api/v1/products/admin/generate-fingerprints:
 *   post:
 *     summary: Tüm ürünler için fingerprint oluşturur (migration)
 *     tags: [Products]
 *     description: |
 *       Mevcut tüm ürünler için fingerprint oluşturur.
 *       Bu endpoint sadece bir kez çalıştırılmalıdır (migration).
 *     responses:
 *       200:
 *         description: Fingerprint'ler oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 processed:
 *                   type: integer
 *                   example: 1247
 */
router.post('/admin/generate-fingerprints', ProductController.generateFingerprints);

export default router;