import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as notificationService from '../services/notificationService';
import { ApiError } from '../utils/apiError';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const data = await notificationService.listNotifications(req.user.id);
  res.status(200).json({ success: true, data });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await notificationService.markRead(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: { read: true } });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await notificationService.markAllRead(req.user.id);
  res.status(200).json({ success: true, data: { read: true } });
});
