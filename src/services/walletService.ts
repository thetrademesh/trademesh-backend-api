import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { toDecimal } from './financialCalculationService';
import { createNotification } from './notificationService';
import { Prisma } from '@prisma/client';

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw ApiError.notFound('Wallet not found for this user.');
  return wallet;
}

export async function listTransactions(userId: string) {
  const wallet = await getWallet(userId);
  return prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/**
 * Every balance-changing operation goes through this helper so that a
 * WalletTransaction + LedgerEntry is always created alongside the balance
 * update, inside the same DB transaction. Nothing is allowed to silently
 * mutate wallet.availableBalance outside of this function.
 */
export async function applyWalletMovement(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    walletId: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_BUY' | 'TRADE_SELL' | 'FEE' | 'ADJUSTMENT';
    amount: Prisma.Decimal.Value; // positive = credit, negative = debit
    description: string;
    referenceType: string;
    referenceId?: string;
  }
) {
  const amountD = toDecimal(params.amount);

  const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: params.walletId } });
  const newBalance = toDecimal(wallet.availableBalance).add(amountD);

  if (newBalance.lessThan(0)) {
    throw ApiError.businessRule('INSUFFICIENT_BALANCE', 'You do not have enough demo balance for this operation.');
  }

  await tx.wallet.update({ where: { id: wallet.id }, data: { availableBalance: newBalance } });

  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: params.type,
      amount: amountD.abs(),
      status: 'COMPLETED',
      description: params.description,
      referenceId: params.referenceId,
    },
  });

  await tx.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      userId: params.userId,
      transactionId: transaction.id,
      debit: amountD.lessThan(0) ? amountD.abs() : new Prisma.Decimal(0),
      credit: amountD.greaterThanOrEqualTo(0) ? amountD : new Prisma.Decimal(0),
      balanceAfter: newBalance,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
    },
  });

  return { wallet: { ...wallet, availableBalance: newBalance }, transaction };
}

export async function demoDeposit(userId: string, amount: number) {
  const wallet = await getWallet(userId);

  const result = await prisma.$transaction(async (tx) => {
    const move = await applyWalletMovement(tx, {
      userId,
      walletId: wallet.id,
      type: 'DEPOSIT',
      amount,
      description: 'Demo funds added',
      referenceType: 'DEMO_DEPOSIT',
    });

    await createNotification(
      tx,
      userId,
      'DEPOSIT',
      'Demo Funds Added',
      `₹${amount.toLocaleString('en-IN')} in demo funds has been added successfully.`
    );

    return move;
  });

  return result.wallet;
}

export async function demoWithdrawal(userId: string, amount: number, destination: string) {
  const wallet = await getWallet(userId);

  if (toDecimal(amount).greaterThan(toDecimal(wallet.availableBalance))) {
    throw ApiError.businessRule('INSUFFICIENT_BALANCE', 'You do not have enough demo balance for this withdrawal.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const move = await applyWalletMovement(tx, {
      userId,
      walletId: wallet.id,
      type: 'WITHDRAWAL',
      amount: -amount,
      description: `Simulated withdrawal to ${destination}`,
      referenceType: 'DEMO_WITHDRAWAL',
    });

    await createNotification(
      tx,
      userId,
      'WITHDRAWAL',
      'Demo Withdrawal Submitted',
      `₹${amount.toLocaleString('en-IN')} withdrawal simulated (no real transfer occurs).`
    );

    return move;
  });

  return result.wallet;
}
