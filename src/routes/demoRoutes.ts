import { Router } from 'express';
import * as demoController from '../controllers/demoController';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// POST /api/demo/reset is intentionally left open (no auth) because it
// resets the single seeded demo user for repeatable sales/demo walkthroughs.
// Everything else that touches an arbitrary user's data requires admin auth.
router.post('/reset', demoController.reset);

router.post('/add-funds', requireAuth, requireAdmin, demoController.addFunds);
router.post('/move-price', requireAuth, requireAdmin, demoController.movePrice);
router.post('/orders/:id/fill', requireAuth, requireAdmin, demoController.fillOrder);
router.post('/kyc/verify', requireAuth, requireAdmin, demoController.markKycVerified);
router.post('/notifications', requireAuth, requireAdmin, demoController.createNotification);

export default router;
