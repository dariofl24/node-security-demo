import { Router } from 'express';

import {
    createProduct,
    deleteProduct,
    listProducts
} from '../controllers/products.controller.js';

import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

/*
 * Público.
 */
router.get(
    '/',
    listProducts
);

/*
 * Solamente admin.
 */
router.post(
    '/',
    requireAuth,
    requireRole('admin'),
    createProduct
);

/*
 * Solamente admin.
 */
router.delete(
    '/:id',
    requireAuth,
    requireRole('admin'),
    deleteProduct
);

export default router;
