import { Router } from 'express';
import * as StoreBranchController from './store-branches.controller.js';
import { validate } from '../../schema/validation.middleware.js';
import { requireIngestKey } from '../../middleware/ingest-auth.middleware.js';
import { bulkUpsertStoreBranchesSchema } from './store-branch.schema.js';

const router = Router();

/**
 * @swagger
 * /api/v1/store-branches/bulk-upsert:
 *   post:
 *     summary: Şube (konum) toplu upsert — scraper depo verisinden
 *     tags: [StoreBranches]
 *     description: |
 *       Scraper, ürün tararken topladığı benzersiz şubeleri (external_ref = 'mf:<depotId>')
 *       buraya gönderir. compare-engine "en yakın şube" mesafesini bu tablodan hesaplar.
 *       Ingest-key korumalı; ülke x-country header'ından çözülür.
 */
router.post(
    '/bulk-upsert',
    requireIngestKey,
    validate(bulkUpsertStoreBranchesSchema),
    StoreBranchController.bulkUpsertStoreBranches
);

export default router;
