import { Router } from 'express';
import authRouter from './auth/auth.routes.js';
import productsRouter from './products/products.routes.js';
import storesRouter from './stores/stores.routes.js';
import storePricesRouter from './store-prices/store-prices.routes.js';
import categoriesRouter from './categories/categories.routes.js';
import usersRouter from './users/users.routes.js';
import listsRouter from './lists/lists.routes.js';
import feedbackRouter from './feedback/feedback.routes.js';
import profileRouter from './profile/profile.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/products', productsRouter);
router.use('/stores', storesRouter);
router.use('/store-prices', storePricesRouter);
router.use('/categories', categoriesRouter);
router.use('/users', usersRouter);
router.use('/lists', listsRouter);
router.use('/feedback', feedbackRouter);
router.use('/profile', profileRouter);

export default router;