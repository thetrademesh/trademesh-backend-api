import { prisma } from '../config/prisma';
import { calcMarketValue, calcUnrealizedPnl, toDecimal } from './financialCalculationService';
import { getWallet } from './walletService';

export async function getHoldings(userId: string) {
  const holdings = await prisma.holding.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: { asset: true },
    orderBy: { updatedAt: 'desc' },
  });

  return holdings.map((h) => {
    const marketValue = calcMarketValue(h.quantity, h.asset.currentPrice);
    const unrealizedPnl = calcUnrealizedPnl(h.quantity, h.averagePrice, h.asset.currentPrice);
    const pnlPercent = toDecimal(h.averagePrice).isZero()
      ? toDecimal(0)
      : unrealizedPnl.div(toDecimal(h.averagePrice).mul(h.quantity)).mul(100).toDecimalPlaces(2);

    return {
      assetId: h.assetId,
      symbol: h.asset.symbol,
      name: h.asset.name,
      type: h.asset.type,
      quantity: h.quantity,
      averagePrice: h.averagePrice,
      currentPrice: h.asset.currentPrice,
      marketValue,
      unrealizedPnl,
      pnlPercent,
      realizedPnl: h.realizedPnl,
    };
  });
}

/** Server-calculated portfolio summary — never trust a frontend-computed total. */
export async function getPortfolioSummary(userId: string) {
  const [wallet, holdings] = await Promise.all([getWallet(userId), getHoldings(userId)]);

  const investedValue = holdings.reduce(
    (sum, h) => sum.add(toDecimal(h.quantity).mul(toDecimal(h.averagePrice))),
    toDecimal(0)
  );
  const marketValue = holdings.reduce((sum, h) => sum.add(toDecimal(h.marketValue)), toDecimal(0));
  const unrealizedPnl = holdings.reduce((sum, h) => sum.add(toDecimal(h.unrealizedPnl)), toDecimal(0));

  const realizedPnlAgg = await prisma.holding.aggregate({
    where: { userId },
    _sum: { realizedPnl: true },
  });
  const realizedPnl = toDecimal(realizedPnlAgg._sum.realizedPnl ?? 0);

  const cashBalance = toDecimal(wallet.availableBalance);
  const totalValue = cashBalance.add(marketValue);

  return {
    totalValue: totalValue.toDecimalPlaces(2),
    cashBalance: cashBalance.toDecimalPlaces(2),
    investedValue: investedValue.toDecimalPlaces(2),
    marketValue: marketValue.toDecimalPlaces(2),
    unrealizedPnl: unrealizedPnl.toDecimalPlaces(2),
    realizedPnl: realizedPnl.toDecimalPlaces(2),
    openPositions: holdings.length,
  };
}
