import { Router } from 'express';
import * as SeoController from './seo.controller.js';
import { requireIngestKey } from '../../middleware/ingest-auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/seo/export:
 *   get:
 *     summary: Statik site üretimi için toplu veri (ingest anahtarı gerekir)
 *     tags: [SEO]
 *     responses:
 *       200: { description: Ülke bazında ürün, kategori, market ve şehir verisi }
 */
router.get('/export', requireIngestKey, SeoController.exportAll);

export default router;
