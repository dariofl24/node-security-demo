import { Router } from 'express';

import { getProfile } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get(
    '/',
    requireAuth,
    getProfile
);

export default router;
