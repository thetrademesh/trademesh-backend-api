import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getPortfolioSummary, getHoldings } from '../services/portfolioService';
import { ApiError } from '../utils/apiError';

export const getPortfolio = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const data = await getPortfolioSummary(req.user.id);
  res.status(200).json({ success: true, data });
});

export const getHoldingsHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const data = await getHoldings(req.user.id);
  res.status(200).json({ success: true, data });
});

export const getPerformance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const summary = await getPortfolioSummary(req.user.id);
  // Minimal demo performance view derived from the same server-calculated summary.
  res.status(200).json({
    success: true,
    data: {
      totalValue: summary.totalValue,
      unrealizedPnl: summary.unrealizedPnl,
      realizedPnl: summary.realizedPnl,
    },
  });
});
