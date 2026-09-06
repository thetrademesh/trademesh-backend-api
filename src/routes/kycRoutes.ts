import { Router } from 'express';
import * as kycController from '../controllers/kycController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', kycController.getKyc);
router.post('/submit', kycController.submitKyc);
router.post('/demo-verify', kycController.demoVerify);

export default router;
