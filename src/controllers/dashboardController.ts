import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getDashboard } from '../services/dashboardService';
import { ApiError } from '../utils/apiError';

export const getDashboardHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const data = await getDashboard(req.user.id);
  res.status(200).json({ success: true, data });
});
