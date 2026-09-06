import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as watchlistService from '../services/watchlistService';
import { ApiError } from '../utils/apiError';
import { z } from 'zod';

const addItemSchema = z.object({ assetId: z.string().min(1) });

export const listWatchlists = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const data = await watchlistService.listWatchlists(req.user.id);
  res.status(200).json({ success: true, data });
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { assetId } = addItemSchema.parse(req.body);
  const item = await watchlistService.addToWatchlist(req.user.id, assetId);
  res.status(201).json({ success: true, data: item });
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await watchlistService.removeFromWatchlist(req.user.id, req.params.assetId);
  res.status(200).json({ success: true, data: { removed: true } });
});
