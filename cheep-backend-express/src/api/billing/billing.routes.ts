import { Router } from 'express';
import * as C from './billing.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRevenueCatSecret } from '../../middleware/revenuecat-auth.middleware.js';

const router = Router();

// Sunucudan sunucuya: kullanıcı oturumu yok, paylaşılan sır ile korunur.
router.post('/revenuecat/webhook', requireRevenueCatSecret, C.revenuecatWebhook);

// Uygulamadan çağrılanlar.
router.get('/status', authenticate, C.status);
router.post('/sync', authenticate, C.sync);

export default router;
