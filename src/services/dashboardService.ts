import { prisma } from '../config/prisma';
import { getPortfolioSummary, getHoldings } from './portfolioService';
import { getWallet } from './walletService';

export async function getDashboard(userId: string) {
  const [user, wallet, portfolio, holdings, recentOrders, watchlist, notifications, marketHighlights] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      getWallet(userId),
      getPortfolioSummary(userId),
      getHoldings(userId),
      prisma.order.findMany({
        where: { userId },
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.watchlist.findFirst({
        where: { userId },
        include: { items: { include: { asset: true } } },
      }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.asset.findMany({ where: { isActive: true }, orderBy: { symbol: 'asc' } }),
    ]);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
    wallet,
    portfolio,
    holdings,
    recentOrders,
    watchlist: watchlist?.items ?? [],
    notifications,
    marketHighlights,
  };
}
