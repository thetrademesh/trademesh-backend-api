import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as kycService from '../services/kycService';
import { kycSubmitSchema } from '../validators/kycValidators';
import { ApiError } from '../utils/apiError';

export const getKyc = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const data = await kycService.getKyc(req.user.id);
  res.status(200).json({ success: true, data });
});

export const submitKyc = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const input = kycSubmitSchema.parse(req.body);
  const data = await kycService.submitKyc(req.user.id, input);
  res.status(200).json({ success: true, data });
});

// Demo-only "verification" endpoint. In this build it's self-service so the
// customer demo can be completed end-to-end; a production variant would
// restrict this to an ADMIN-only route (see demoController for the
// equivalent admin-triggered version).
export const demoVerify = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const data = await kycService.demoVerifyKyc(req.user.id);
  res.status(200).json({ success: true, data });
});
