import { Router } from 'express';
import * as walletController from '../controllers/walletController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', walletController.getWallet);
router.get('/transactions', walletController.listTransactions);
router.post('/demo-deposit', walletController.demoDeposit);
router.post('/demo-withdrawal', walletController.demoWithdrawal);

export default router;
