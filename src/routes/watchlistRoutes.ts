import { Router } from 'express';
import * as watchlistController from '../controllers/watchlistController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', watchlistController.listWatchlists);
router.post('/items', watchlistController.addItem);
router.delete('/items/:assetId', watchlistController.removeItem);

export default router;
