import { Router } from 'express';
import * as assetController from '../controllers/assetController';

const router = Router();

router.get('/', assetController.listAssets);
router.get('/:id', assetController.getAsset);
router.get('/:id/quote', assetController.getQuote);
router.get('/:id/history', assetController.getHistory);

export default router;
