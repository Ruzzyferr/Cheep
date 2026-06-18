import { Router } from 'express';
import * as C from './assistant.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import { sendMessageSchema } from './assistant.schema.js';
import { generalLimiter } from '../../middleware/rate-limit.middleware.js';

const router = Router();

// Thread CRUD — all behind authenticate
router.post('/threads', authenticate, C.create);
router.get('/threads', authenticate, C.list);
router.get('/threads/:id', authenticate, C.get);
router.delete('/threads/:id', authenticate, C.remove);

// Message endpoint — additionally rate-limited (Gemini free-tier protection)
router.post(
  '/threads/:id/messages',
  authenticate,
  generalLimiter,
  validate(sendMessageSchema),
  C.message,
);

export default router;
