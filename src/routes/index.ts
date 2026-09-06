import { Router } from 'express';
import authRoutes from './authRoutes';
import dashboardRoutes from './dashboardRoutes';
import assetRoutes from './assetRoutes';
import walletRoutes from './walletRoutes';
import portfolioRoutes from './portfolioRoutes';
import orderRoutes from './orderRoutes';
import watchlistRoutes from './watchlistRoutes';
import notificationRoutes from './notificationRoutes';
import kycRoutes from './kycRoutes';
import searchRoutes from './searchRoutes';
import demoRoutes from './demoRoutes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'trademesh-backend', mode: 'DEMO' } });
});

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/assets', assetRoutes);
router.use('/wallet', walletRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/orders', orderRoutes);
router.use('/watchlists', watchlistRoutes);
router.use('/notifications', notificationRoutes);
router.use('/kyc', kycRoutes);
router.use('/search', searchRoutes);
router.use('/demo', demoRoutes);

export default router;
