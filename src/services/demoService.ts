import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { env } from '../config/env';
import { hashPassword } from '../utils/password';
import { simulatePriceMovement } from './assetService';
import { applyWalletMovement } from './walletService';
import { createNotification } from './notificationService';
import { toDecimal, calcRealizedPnl, calcNewAveragePrice, calcOrderValue, calcFee, calcBuyTotalDebit, calcSellNetProceeds } from './financialCalculationService';

export const DEMO_USER_EMAIL = 'demo@trademesh.app';
export const DEMO_USER_PASSWORD = 'demo1234';

/**
 * Resets the seeded demo user back to their original state so a sales/demo
 * rep can repeat the full walkthrough from scratch. Deletes derived data
 * and restores the wallet, then leaves assets/prices untouched (those are
 * shared across all demo sessions).
 */
export async function resetDemoUser() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
  if (!user) throw ApiError.notFound('Demo user not found. Run the seed script first.');

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany({ where: { userId: user.id } });
    await tx.walletTransaction.deleteMany({ where: { wallet: { userId: user.id } } });
    await tx.order.deleteMany({ where: { userId: user.id } });
    await tx.holding.deleteMany({ where: { userId: user.id } });
    await tx.watchlistItem.deleteMany({ where: { watchlist: { userId: user.id } } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });

    await tx.wallet.update({
      where: { userId: user.id },
      data: { availableBalance: env.demo.initialBalance, lockedBalance: 0 },
    });

    await tx.kycProfile.update({
      where: { userId: user.id },
      data: {
        status: 'NOT_STARTED',
        fullName: null,
        dateOfBirth: null,
        country: null,
        address: null,
        documentType: null,
        documentNumber: null,
        submittedAt: null,
        verifiedAt: null,
        rejectionReason: null,
      },
    });

    await tx.twoFactorAuth.deleteMany({ where: { userId: user.id } });

    await tx.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Demo Reset Complete',
        message: `Demo account restored to its original state with ₹${env.demo.initialBalance} balance.`,
      },
    });
  });

  return { success: true, message: 'Demo account has been reset to its original state.' };
}

export async function adminAddFunds(userId: string, amount: number) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return prisma.$transaction(async (tx) => {
    const move = await applyWalletMovement(tx, {
      userId,
      walletId: wallet.id,
      type: 'ADJUSTMENT',
      amount,
      description: 'Demo/admin control: funds added',
      referenceType: 'ADMIN_ADJUSTMENT',
    });
    await createNotification(tx, userId, 'SYSTEM', 'Demo Funds Added', `An admin/demo control added ₹${amount} in demo funds.`);
    return move.wallet;
  });
}

export async function adminMovePrice(assetId: string) {
  return simulatePriceMovement(assetId);
}

/** Fills a pending OPEN limit order at its limit price (demo/admin only). */
export async function adminFillOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { asset: true } });
    if (!order) throw ApiError.notFound('Order not found.');
    if (order.status !== 'OPEN') {
      throw ApiError.businessRule('ORDER_NOT_FILLABLE', 'Only OPEN orders can be filled.');
    }

    const executionPrice = toDecimal(order.limitPrice ?? order.estimatedPrice);
    const orderValue = calcOrderValue(order.quantity, executionPrice);
    const fee = calcFee(orderValue);
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: order.userId } });

    if (order.side === 'BUY') {
      const totalDebit = calcBuyTotalDebit(orderValue, fee);
      // Funds were already locked at order creation — move locked -> spent.
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { lockedBalance: toDecimal(wallet.lockedBalance).sub(totalDebit) },
      });

      const existingHolding = await tx.holding.findUnique({
        where: { userId_assetId: { userId: order.userId, assetId: order.assetId } },
      });
      const newQty = toDecimal(existingHolding?.quantity ?? 0).add(order.quantity);
      const newAvgPrice = calcNewAveragePrice(
        existingHolding?.quantity ?? 0,
        existingHolding?.averagePrice ?? 0,
        order.quantity,
        executionPrice
      );
      await tx.holding.upsert({
        where: { userId_assetId: { userId: order.userId, assetId: order.assetId } },
        create: { userId: order.userId, assetId: order.assetId, quantity: newQty, averagePrice: newAvgPrice },
        update: { quantity: newQty, averagePrice: newAvgPrice },
      });

      await tx.walletTransaction.create({
        data: { walletId: wallet.id, type: 'TRADE_BUY', amount: totalDebit, status: 'COMPLETED', description: `Limit buy filled: ${order.asset.symbol}` },
      });
    } else {
      const netProceeds = calcSellNetProceeds(orderValue, fee);
      const holding = await tx.holding.findUniqueOrThrow({
        where: { userId_assetId: { userId: order.userId, assetId: order.assetId } },
      });
      const realizedPnl = calcRealizedPnl(order.quantity, executionPrice, holding.averagePrice);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: toDecimal(wallet.availableBalance).add(netProceeds) },
      });
      await tx.holding.update({
        where: { userId_assetId: { userId: order.userId, assetId: order.assetId } },
        data: {
          quantity: toDecimal(holding.quantity).sub(order.quantity),
          realizedPnl: toDecimal(holding.realizedPnl).add(realizedPnl),
        },
      });
      await tx.walletTransaction.create({
        data: { walletId: wallet.id, type: 'TRADE_SELL', amount: netProceeds, status: 'COMPLETED', description: `Limit sell filled: ${order.asset.symbol}` },
      });
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: 'FILLED', executedPrice: executionPrice, executedQuantity: order.quantity, executedAt: new Date(), fee },
    });

    await createNotification(
      tx,
      order.userId,
      'ORDER_FILLED',
      'Demo Limit Order Filled',
      `${order.orderNumber} — ${order.asset.symbol} filled at ${executionPrice} via demo control.`
    );

    return updatedOrder;
  });
}

export async function adminMarkKycVerified(userId: string) {
  const { demoVerifyKyc } = await import('./kycService');
  return demoVerifyKyc(userId);
}

export async function adminCreateNotification(userId: string, title: string, message: string) {
  return prisma.notification.create({ data: { userId, type: 'SYSTEM', title, message } });
}

export { hashPassword };
