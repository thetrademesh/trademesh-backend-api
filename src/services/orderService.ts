import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { env } from '../config/env';
import {
  calcOrderValue,
  calcFee,
  calcBuyTotalDebit,
  calcSellNetProceeds,
  calcNewAveragePrice,
  calcRealizedPnl,
  toDecimal,
} from './financialCalculationService';
import { applyWalletMovement } from './walletService';
import { createNotification } from './notificationService';
import { Prisma } from '@prisma/client';
import type { CreateOrderInput } from '../validators/orderValidators';

function generateOrderNumber() {
  return 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Creates and (for MARKET orders) immediately executes a demo order.
 * The entire flow — balance/holding checks, wallet ledger entry, holding
 * update, order record, notification — runs inside a single DB transaction
 * so nothing can end up half-applied.
 *
 * Idempotency: if an Idempotency-Key was supplied and an order already
 * exists with that key, the existing order is returned unchanged instead
 * of creating a duplicate (protects against double-click / retry).
 */
export async function createOrder(
  userId: string,
  input: CreateOrderInput,
  idempotencyKey?: string
) {
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing && existing.userId === userId) {
      return existing;
    }
  }

  const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
  if (!asset) throw ApiError.notFound('Asset not found.');
  if (!asset.isActive) {
    throw ApiError.businessRule('ASSET_INACTIVE', 'This asset is not currently tradable.');
  }

  const quantity = toDecimal(input.quantity);
  const marketPrice = toDecimal(asset.currentPrice);
  const referencePrice = input.orderType === 'LIMIT' ? toDecimal(input.limitPrice!) : marketPrice;

  const orderValue = calcOrderValue(quantity, referencePrice);
  if (orderValue.greaterThan(env.demo.maxOrderValue)) {
    throw ApiError.businessRule(
      'ORDER_TOO_LARGE',
      `Order value exceeds the demo maximum of ${env.demo.maxOrderValue}.`
    );
  }
  const fee = calcFee(orderValue);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    const orderNumber = generateOrderNumber();

    // LIMIT orders that aren't immediately marketable are left OPEN for
    // a demo/admin control to fill later (see demoService.fillOrder).
    const willExecuteNow =
      input.orderType === 'MARKET' ||
      (input.side === 'BUY' && referencePrice.greaterThanOrEqualTo(marketPrice)) ||
      (input.side === 'SELL' && referencePrice.lessThanOrEqualTo(marketPrice));

    if (!willExecuteNow) {
      // Reserve funds for an open BUY limit order so the user can't
      // spend the same demo cash twice while it's pending.
      if (input.side === 'BUY') {
        const totalDebit = calcBuyTotalDebit(orderValue, fee);
        if (totalDebit.greaterThan(toDecimal(wallet.availableBalance))) {
          throw ApiError.businessRule('INSUFFICIENT_BALANCE', 'You do not have enough demo balance for this order.');
        }
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: toDecimal(wallet.availableBalance).sub(totalDebit),
            lockedBalance: toDecimal(wallet.lockedBalance).add(totalDebit),
          },
        });
      } else {
        const holding = await tx.holding.findUnique({ where: { userId_assetId: { userId, assetId: asset.id } } });
        if (!holding || toDecimal(holding.quantity).lessThan(quantity)) {
          throw ApiError.businessRule('INSUFFICIENT_HOLDINGS', 'You do not hold enough quantity for this order.');
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          assetId: asset.id,
          side: input.side,
          orderType: input.orderType,
          quantity,
          limitPrice: input.limitPrice ? toDecimal(input.limitPrice) : null,
          estimatedPrice: referencePrice,
          fee,
          status: 'OPEN',
          idempotencyKey,
        },
      });

      await createNotification(
        tx,
        userId,
        'ORDER_FILLED',
        'Demo Limit Order Placed',
        `${orderNumber} — ${asset.symbol} ${input.side} order is OPEN, waiting to fill at ${input.limitPrice}.`
      );

      return order;
    }

    // ---- Immediate execution (market order, or limit order that crosses the market) ----
    const executionPrice = marketPrice;
    const execOrderValue = calcOrderValue(quantity, executionPrice);
    const execFee = calcFee(execOrderValue);

    let realizedPnl: Prisma.Decimal | undefined;

    if (input.side === 'BUY') {
      const totalDebit = calcBuyTotalDebit(execOrderValue, execFee);
      if (totalDebit.greaterThan(toDecimal(wallet.availableBalance))) {
        throw ApiError.businessRule('INSUFFICIENT_BALANCE', 'You do not have enough demo balance for this order.');
      }

      await applyWalletMovement(tx, {
        userId,
        walletId: wallet.id,
        type: 'TRADE_BUY',
        amount: totalDebit.neg(),
        description: `Buy ${quantity} ${asset.symbol}`,
        referenceType: 'ORDER',
        referenceId: orderNumber,
      });

      const existingHolding = await tx.holding.findUnique({
        where: { userId_assetId: { userId, assetId: asset.id } },
      });

      const newQty = toDecimal(existingHolding?.quantity ?? 0).add(quantity);
      const newAvgPrice = calcNewAveragePrice(
        existingHolding?.quantity ?? 0,
        existingHolding?.averagePrice ?? 0,
        quantity,
        executionPrice
      );

      await tx.holding.upsert({
        where: { userId_assetId: { userId, assetId: asset.id } },
        create: { userId, assetId: asset.id, quantity: newQty, averagePrice: newAvgPrice },
        update: { quantity: newQty, averagePrice: newAvgPrice },
      });
    } else {
      const holding = await tx.holding.findUnique({ where: { userId_assetId: { userId, assetId: asset.id } } });
      if (!holding || toDecimal(holding.quantity).lessThan(quantity)) {
        throw ApiError.businessRule('INSUFFICIENT_HOLDINGS', 'You do not hold enough quantity for this order.');
      }

      const netProceeds = calcSellNetProceeds(execOrderValue, execFee);
      realizedPnl = calcRealizedPnl(quantity, executionPrice, holding.averagePrice);

      await applyWalletMovement(tx, {
        userId,
        walletId: wallet.id,
        type: 'TRADE_SELL',
        amount: netProceeds,
        description: `Sell ${quantity} ${asset.symbol}`,
        referenceType: 'ORDER',
        referenceId: orderNumber,
      });

      const remainingQty = toDecimal(holding.quantity).sub(quantity);
      await tx.holding.update({
        where: { userId_assetId: { userId, assetId: asset.id } },
        data: {
          quantity: remainingQty,
          realizedPnl: toDecimal(holding.realizedPnl).add(realizedPnl),
          // Average price is preserved for any remaining quantity; if the
          // position is fully closed we leave it as historical reference.
        },
      });
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId,
        assetId: asset.id,
        side: input.side,
        orderType: input.orderType,
        quantity,
        limitPrice: input.limitPrice ? toDecimal(input.limitPrice) : null,
        estimatedPrice: referencePrice,
        executedPrice: executionPrice,
        executedQuantity: quantity,
        fee: execFee,
        status: 'FILLED',
        executedAt: new Date(),
        idempotencyKey,
      },
    });

    await createNotification(
      tx,
      userId,
      'ORDER_FILLED',
      'Demo Order Filled',
      `${orderNumber} — ${asset.symbol} ${input.side} x${quantity} filled at ${executionPrice} (simulated execution).`
    );

    await tx.auditLog.create({
      data: {
        userId,
        action: 'ORDER_FILLED',
        metaJson: JSON.stringify({ orderNumber, symbol: asset.symbol, side: input.side, quantity: quantity.toString() }),
      },
    });

    return order;
  });
}

export async function listOrders(
  userId: string,
  filter: { side?: string; status?: string; orderType?: string; assetId?: string; page: number; pageSize: number }
) {
  const where = {
    userId,
    ...(filter.side ? { side: filter.side as any } : {}),
    ...(filter.status ? { status: filter.status as any } : {}),
    ...(filter.orderType ? { orderType: filter.orderType as any } : {}),
    ...(filter.assetId ? { assetId: filter.assetId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { asset: true },
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total, page: filter.page, pageSize: filter.pageSize };
}

export async function getOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { asset: true } });
  if (!order) throw ApiError.notFound('Order not found.');
  return order;
}

export async function cancelOrder(userId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw ApiError.notFound('Order not found.');
    if (order.status !== 'OPEN' && order.status !== 'PENDING') {
      throw ApiError.businessRule('ORDER_NOT_CANCELLABLE', 'Only open or pending orders can be cancelled.');
    }

    // Release any funds that were locked for an open BUY limit order.
    if (order.side === 'BUY') {
      const orderValue = calcOrderValue(order.quantity, order.limitPrice ?? order.estimatedPrice);
      const fee = calcFee(orderValue);
      const totalLocked = calcBuyTotalDebit(orderValue, fee);
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: toDecimal(wallet.availableBalance).add(totalLocked),
          lockedBalance: toDecimal(wallet.lockedBalance).sub(totalLocked),
        },
      });
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await createNotification(
      tx,
      userId,
      'ORDER_CANCELLED',
      'Demo Order Cancelled',
      `${order.orderNumber} was cancelled.`
    );

    return updated;
  });
}
