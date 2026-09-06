import { Router } from 'express';
import * as assetController from '../controllers/assetController';

const router = Router();
router.get('/', assetController.search);

export default router;
