import { Router } from 'express';
import * as portfolioController from '../controllers/portfolioController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', portfolioController.getPortfolio);
router.get('/holdings', portfolioController.getHoldingsHandler);
router.get('/performance', portfolioController.getPerformance);

export default router;
