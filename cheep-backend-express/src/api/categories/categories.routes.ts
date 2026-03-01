// ============================================
// src/api/categories/categories.routes.ts
// HİYERARŞİK KATEGORİ ROUTES
// ============================================
import { Router } from 'express';
import * as CategoryController from './categories.controller.js';
import { validate } from '../../schema/validation.middleware.js';
import { createCategorySchema, updateCategorySchema } from './category.schema.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Hiyerarşik kategori yönetimi
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "Süt Ürünleri"
 *         slug:
 *           type: string
 *           example: "sut-urunleri"
 *         parent_id:
 *           type: integer
 *           nullable: true
 *           example: null
 *         display_order:
 *           type: integer
 *           example: 1
 *         icon_url:
 *           type: string
 *           example: "🥛"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     CategoryWithChildren:
 *       allOf:
 *         - $ref: '#/components/schemas/Category'
 *         - type: object
 *           properties:
 *             children:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *             _count:
 *               type: object
 *               properties:
 *                 products:
 *                   type: integer
 *                 children:
 *                   type: integer
 */

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: Tüm kategorileri listeler (düz liste, parent bilgisi ile)
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CategoryWithChildren'
 */
router.get('/', CategoryController.getAllCategories);

/**
 * @swagger
 * /api/v1/categories/parent:
 *   get:
 *     summary: Sadece ana kategorileri listeler (parent_id = null)
 *     tags: [Categories]
 *     description: Kullanıcının üst menüde göreceği kategoriler
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CategoryWithChildren'
 *             example:
 *               - id: 1
 *                 name: "Süt Ürünleri"
 *                 slug: "sut-urunleri"
 *                 parent_id: null
 *                 display_order: 1
 *                 _count:
 *                   products: 15
 *                   children: 7
 */
router.get('/parent', CategoryController.getParentCategories);

/**
 * @swagger
 * /api/v1/categories/tree:
 *   get:
 *     summary: Hiyerarşik tree yapısını döndürür (parent -> children)
 *     tags: [Categories]
 *     description: |
 *       Tüm kategorileri tree yapısında döndürür.
 *       Ana kategoriler ve altlarında children array'i.
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CategoryWithChildren'
 *             example:
 *               - id: 1
 *                 name: "Süt Ürünleri"
 *                 slug: "sut-urunleri"
 *                 parent_id: null
 *                 children:
 *                   - id: 2
 *                     name: "Süt"
 *                     slug: "sut"
 *                     parent_id: 1
 *                   - id: 3
 *                     name: "Peynir"
 *                     slug: "peynir"
 *                     parent_id: 1
 */
router.get('/tree', CategoryController.getCategoryTree);

/**
 * @swagger
 * /api/v1/categories/{id}/subcategories:
 *   get:
 *     summary: Bir kategorinin alt kategorilerini listeler
 *     tags: [Categories]
 *     description: Kullanıcı bir ana kategoriye tıkladığında altındaki kategorileri göster
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Parent kategori ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *             example:
 *               - id: 2
 *                 name: "Süt"
 *                 slug: "sut"
 *                 parent_id: 1
 *                 display_order: 1
 *               - id: 3
 *                 name: "Peynir"
 *                 slug: "peynir"
 *                 parent_id: 1
 *                 display_order: 2
 */
router.get('/:id/subcategories', CategoryController.getSubcategories);

/**
 * @swagger
 * /api/v1/categories/{id}/breadcrumb:
 *   get:
 *     summary: Kategorinin breadcrumb'ını getirir
 *     tags: [Categories]
 *     description: Ana Sayfa > Süt Ürünleri > Peynir gibi yol
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *             example:
 *               - id: 1
 *                 name: "Süt Ürünleri"
 *                 slug: "sut-urunleri"
 *               - id: 3
 *                 name: "Peynir"
 *                 slug: "peynir"
 */
router.get('/:id/breadcrumb', CategoryController.getCategoryBreadcrumb);

/**
 * @swagger
 * /api/v1/categories/{id}/product-count:
 *   get:
 *     summary: Kategorideki ürün sayısını döndürür
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeChildren
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Alt kategorilerdeki ürünler dahil edilsin mi?
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 42
 */
router.get('/:id/product-count', CategoryController.getCategoryProductCount);

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   get:
 *     summary: ID'ye göre kategori getirir (children ile)
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryWithChildren'
 *       404:
 *         description: Kategori bulunamadı
 */
router.get('/:id', CategoryController.getCategoryById);

/**
 * @swagger
 * /api/v1/categories/slug/{slug}:
 *   get:
 *     summary: Slug'a göre kategori getirir
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         example: "sut-urunleri"
 *     responses:
 *       200:
 *         description: Başarılı
 *       404:
 *         description: Kategori bulunamadı
 */
router.get('/slug/:slug', CategoryController.getCategoryBySlug);

/**
 * @swagger
 * /api/v1/categories:
 *   post:
 *     summary: Yeni kategori oluşturur
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Yoğurt"
 *               slug:
 *                 type: string
 *                 example: "yogurt"
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 1
 *               display_order:
 *                 type: integer
 *                 example: 3
 *               icon_url:
 *                 type: string
 *                 example: "🥛"
 *     responses:
 *       201:
 *         description: Kategori oluşturuldu
 *       400:
 *         description: Validation hatası
 */
router.post('/', validate(createCategorySchema), CategoryController.createCategory);

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   put:
 *     summary: Kategori günceller
 *     tags: [Categories]
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
 *               slug:
 *                 type: string
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *               display_order:
 *                 type: integer
 *               icon_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Kategori güncellendi
 *       404:
 *         description: Kategori bulunamadı
 */
router.put('/:id', validate(updateCategorySchema), CategoryController.updateCategory);

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   delete:
 *     summary: Kategori siler
 *     tags: [Categories]
 *     description: |
 *       Alt kategorisi veya ürünü olan kategori silinemez.
 *       Önce ürünleri taşıyın veya alt kategorileri silin.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Kategori silindi
 *       400:
 *         description: Alt kategorisi veya ürünü var
 *       404:
 *         description: Kategori bulunamadı
 */
router.delete('/:id', CategoryController.deleteCategory);

export default router;

