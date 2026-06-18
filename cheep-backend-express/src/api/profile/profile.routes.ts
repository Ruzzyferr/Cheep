import { Router } from 'express';
import * as ProfileController from './profile.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../schema/validation.middleware.js';
import { updateProfileSchema } from './profile.schema.js';

const router = Router();

router.get('/', authenticate, ProfileController.getMyProfile);
router.put('/', authenticate, validate(updateProfileSchema), ProfileController.updateMyProfile);

export default router;
