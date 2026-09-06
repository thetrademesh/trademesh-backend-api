import { Prisma } from '@prisma/client';
import { env } from '../config/env';

// All money math for the app is centralized here and uses Prisma.Decimal
// throughout — never native JS floating point — so cents don't silently
// drift across thousands of demo trades.

const D = (val: Prisma.Decimal.Value) => new Prisma.Decimal(val);

export const FEE_PERCENT = D(env.demo.tradingFeePercent).div(100); // e.g. 0.1% -> 0.001

export function calcOrderValue(quantity: Prisma.Decimal.Value, price: Prisma.Decimal.Value) {
  return D(quantity).mul(D(price));
}

export function calcFee(orderValue: Prisma.Decimal.Value) {
  return D(orderValue).mul(FEE_PERCENT).toDecimalPlaces(2);
}

export function calcBuyTotalDebit(orderValue: Prisma.Decimal.Value, fee: Prisma.Decimal.Value) {
  return D(orderValue).add(D(fee));
}

export function calcSellNetProceeds(orderValue: Prisma.Decimal.Value, fee: Prisma.Decimal.Value) {
  return D(orderValue).sub(D(fee));
}

/** New weighted-average cost basis after a BUY fill. */
export function calcNewAveragePrice(
  existingQty: Prisma.Decimal.Value,
  existingAvgPrice: Prisma.Decimal.Value,
  addedQty: Prisma.Decimal.Value,
  addedPrice: Prisma.Decimal.Value
) {
  const existingQtyD = D(existingQty);
  const addedQtyD = D(addedQty);
  const totalQty = existingQtyD.add(addedQtyD);
  if (totalQty.isZero()) return D(0);
  const totalCost = existingQtyD.mul(D(existingAvgPrice)).add(addedQtyD.mul(D(addedPrice)));
  return totalCost.div(totalQty).toDecimalPlaces(6);
}

/** Realized P&L booked when reducing/closing a position on a SELL. */
export function calcRealizedPnl(
  sellQty: Prisma.Decimal.Value,
  sellPrice: Prisma.Decimal.Value,
  avgPrice: Prisma.Decimal.Value
) {
  return D(sellQty).mul(D(sellPrice).sub(D(avgPrice))).toDecimalPlaces(2);
}

/** Unrealized P&L for an open holding at the current market price. */
export function calcUnrealizedPnl(
  qty: Prisma.Decimal.Value,
  avgPrice: Prisma.Decimal.Value,
  currentPrice: Prisma.Decimal.Value
) {
  return D(qty).mul(D(currentPrice).sub(D(avgPrice))).toDecimalPlaces(2);
}

export function calcMarketValue(qty: Prisma.Decimal.Value, currentPrice: Prisma.Decimal.Value) {
  return D(qty).mul(D(currentPrice)).toDecimalPlaces(2);
}

export { D as toDecimal };
