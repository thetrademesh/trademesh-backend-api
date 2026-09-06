import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as orderService from '../services/orderService';
import { createOrderSchema, listOrdersQuerySchema } from '../validators/orderValidators';
import { ApiError } from '../utils/apiError';

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const input = createOrderSchema.parse(req.body);
  const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
  const order = await orderService.createOrder(req.user.id, input, idempotencyKey);
  res.status(201).json({ success: true, data: order });
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const query = listOrdersQuerySchema.parse(req.query);
  const result = await orderService.listOrders(req.user.id, query);
  res.status(200).json({ success: true, data: result });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const order = await orderService.getOrder(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: order });
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const order = await orderService.cancelOrder(req.user.id, req.params.id);
  res.status(200).json({ success: true, data: order });
});
