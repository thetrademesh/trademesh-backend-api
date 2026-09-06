import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as demoService from '../services/demoService';
import { ApiError } from '../utils/apiError';
import { env } from '../config/env';
import { z } from 'zod';

function ensureDemoControlsEnabled() {
  if (!env.demo.controlsEnabled) {
    throw ApiError.forbidden('Demo controls are disabled in this environment.');
  }
}

export const reset = asyncHandler(async (_req: Request, res: Response) => {
  ensureDemoControlsEnabled();
  const result = await demoService.resetDemoUser();
  res.status(200).json({ success: true, data: result });
});

const addFundsSchema = z.object({ userId: z.string(), amount: z.number().positive() });
export const addFunds = asyncHandler(async (req: Request, res: Response) => {
  ensureDemoControlsEnabled();
  const { userId, amount } = addFundsSchema.parse(req.body);
  const wallet = await demoService.adminAddFunds(userId, amount);
  res.status(200).json({ success: true, data: wallet });
});

const movePriceSchema = z.object({ assetId: z.string() });
export const movePrice = asyncHandler(async (req: Request, res: Response) => {
  ensureDemoControlsEnabled();
  const { assetId } = movePriceSchema.parse(req.body);
  const asset = await demoService.adminMovePrice(assetId);
  res.status(200).json({ success: true, data: asset });
});

export const fillOrder = asyncHandler(async (req: Request, res: Response) => {
  ensureDemoControlsEnabled();
  const order = await demoService.adminFillOrder(req.params.id);
  res.status(200).json({ success: true, data: order });
});

const markKycSchema = z.object({ userId: z.string() });
export const markKycVerified = asyncHandler(async (req: Request, res: Response) => {
  ensureDemoControlsEnabled();
  const { userId } = markKycSchema.parse(req.body);
  const kyc = await demoService.adminMarkKycVerified(userId);
  res.status(200).json({ success: true, data: kyc });
});

const createNotifSchema = z.object({ userId: z.string(), title: z.string(), message: z.string() });
export const createNotification = asyncHandler(async (req: Request, res: Response) => {
  ensureDemoControlsEnabled();
  const { userId, title, message } = createNotifSchema.parse(req.body);
  const notif = await demoService.adminCreateNotification(userId, title, message);
  res.status(201).json({ success: true, data: notif });
});
