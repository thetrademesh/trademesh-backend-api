import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as walletService from '../services/walletService';
import { demoDepositSchema, demoWithdrawalSchema } from '../validators/walletValidators';
import { ApiError } from '../utils/apiError';

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const wallet = await walletService.getWallet(req.user.id);
  res.status(200).json({ success: true, data: wallet });
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const txs = await walletService.listTransactions(req.user.id);
  res.status(200).json({ success: true, data: txs });
});

export const demoDeposit = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { amount } = demoDepositSchema.parse(req.body);
  const wallet = await walletService.demoDeposit(req.user.id, amount);
  res.status(200).json({ success: true, data: wallet, message: `₹${amount} demo funds added successfully.` });
});

export const demoWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { amount, destination } = demoWithdrawalSchema.parse(req.body);
  const wallet = await walletService.demoWithdrawal(req.user.id, amount, destination);
  res.status(200).json({ success: true, data: wallet, message: 'Demo withdrawal submitted (simulated).' });
});
