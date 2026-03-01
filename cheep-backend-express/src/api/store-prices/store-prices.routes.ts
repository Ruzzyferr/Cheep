import { Router } from 'express';
import * as StorePriceController from './store-prices.controller.js';
import * as LLMStorePriceController from './store-prices-llm.controller.js';
import { validate } from '../../schema/validation.middleware.js';
import {
    bulkUpsertStorePricesSchema,
    upsertStorePriceSchema
} from './store-price.schema.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: StorePrices
 *   description: Market fiyat yönetimi
 */

/**
 * @swagger
 * /api/v1/store-prices/upsert:
 *   post:
 *     summary: Fiyat bilgisini ekler veya günceller
 *     tags: [StorePrices]
 *     description: Aynı market-ürün çifti için fiyatı günceller, yoksa oluşturur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - store_id
 *               - product_id
 *               - price
 *             properties:
 *               store_id:
 *                 type: string
 *                 example: "cm3store123"
 *               product_id:
 *                 type: string
 *                 example: "cm3prod456"
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 45.50
 *               unit:
 *                 type: string
 *                 enum: [adet, kg, g, l, ml, cl, paket, kutu]
 *                 default: "adet"
 *               source:
 *                 type: string
 *                 enum: [scrape, api, user]
 *                 default: "scrape"
 *               confidence_score:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 1.0
 *     responses:
 *       200:
 *         description: Fiyat başarıyla upsert edildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StorePrice'
 *       400:
 *         description: Validation hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    '/upsert',
    validate(upsertStorePriceSchema),
    StorePriceController.upsertStorePrice
);

/**
 * @swagger
 * /api/v1/store-prices/bulk-upsert:
 *   post:
 *     summary: Toplu fiyat güncelleme
 *     tags: [StorePrices]
 *     description: Birden fazla ürün fiyatını tek seferde günceller (max 1000)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prices
 *             properties:
 *               prices:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 1000
 *                 items:
 *                   type: object
 *                   required:
 *                     - store_id
 *                     - product_id
 *                     - price
 *                   properties:
 *                     store_id:
 *                       type: string
 *                     product_id:
 *                       type: string
 *                     price:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     source:
 *                       type: string
 *           example:
 *             prices:
 *               - store_id: "cm3store123"
 *                 product_id: "cm3prod456"
 *                 price: 45.50
 *                 unit: "adet"
 *               - store_id: "cm3store123"
 *                 product_id: "cm3prod789"
 *                 price: 28.90
 *                 unit: "kg"
 *     responses:
 *       200:
 *         description: Toplu işlem tamamlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Toplam işlem sayısı
 *                 successful:
 *                   type: integer
 *                   description: Başarılı işlem sayısı
 *                 failed:
 *                   type: integer
 *                   description: Başarısız işlem sayısı
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       success:
 *                         type: boolean
 *                       data:
 *                         type: object
 *                       error:
 *                         type: string
 *       400:
 *         description: Validation hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    '/bulk-upsert',
    validate(bulkUpsertStorePricesSchema),
    StorePriceController.bulkUpsertStorePrices
);

/**
 * @swagger
 * /api/v1/store-prices/import-with-llm:
 *   post:
 *     summary: LLM ile ürün import (Market bazlı optimize edilmiş)
 *     tags: [StorePrices]
 *     description: |
 *       Market bazlı gruplama ile optimize edilmiş LLM tabanlı ürün import.
 *       Her market için tüm ürünleri tek seferde LLM'e gönderir.
 *       Ürünleri normalize eder, kategorize eder ve cross-market matching yapar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - products
 *             properties:
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - store_id
 *                     - store_sku
 *                     - price
 *                   properties:
 *                     name:
 *                       type: string
 *                     brand:
 *                       type: string
 *                     store_id:
 *                       type: integer
 *                     store_name:
 *                       type: string
 *                     store_sku:
 *                       type: string
 *                     price:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     raw_category:
 *                       type: string
 *                     image_url:
 *                       type: string
 *               use_llm:
 *                 type: boolean
 *                 default: true
 *           example:
 *             products:
 *               - name: "Sütaş Süt 1L"
 *                 brand: "Sütaş"
 *                 store_id: 1
 *                 store_name: "Migros"
 *                 store_sku: "MIG-12345"
 *                 price: 34.50
 *                 unit: "adet"
 *                 raw_category: "Süt Ürünleri"
 *             use_llm: true
 *     responses:
 *       200:
 *         description: Import başarılı
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
 *                     total:
 *                       type: integer
 *                     processed:
 *                       type: integer
 *                     saved:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     stats:
 *                       type: object
 *                       properties:
 *                         new_products:
 *                           type: integer
 *                         matched_products:
 *                           type: integer
 *                         updated_prices:
 *                           type: integer
 *                 message:
 *                   type: string
 */
router.post('/import-with-llm', LLMStorePriceController.importWithLLM);

export default router;