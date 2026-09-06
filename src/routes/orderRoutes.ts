import { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { requireAuth } from '../middleware/auth';
import { orderLimiter } from '../middleware/rateLimit';

const router = Router();
router.use(requireAuth);

router.post('/', orderLimiter, orderController.createOrder);
router.get('/', orderController.listOrders);
router.get('/:id', orderController.getOrder);
router.post('/:id/cancel', orderController.cancelOrder);

export default router;
