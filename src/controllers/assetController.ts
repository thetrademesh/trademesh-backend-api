import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as assetService from '../services/assetService';

export const listAssets = asyncHandler(async (req: Request, res: Response) => {
  const { type, search } = req.query as { type?: string; search?: string };
  const assets = await assetService.listAssets({ type, search });
  res.status(200).json({ success: true, data: assets });
});

export const getAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetService.getAssetById(req.params.id);
  res.status(200).json({ success: true, data: asset });
});

export const getQuote = asyncHandler(async (req: Request, res: Response) => {
  const quote = await assetService.getAssetQuote(req.params.id);
  res.status(200).json({ success: true, data: quote });
});

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await assetService.getAssetHistory(req.params.id);
  res.status(200).json({ success: true, data: history });
});

export const search = asyncHandler(async (req: Request, res: Response) => {
  const q = (req.query.q as string) ?? '';
  const results = await assetService.searchAssets(q);
  res.status(200).json({ success: true, data: results });
});
