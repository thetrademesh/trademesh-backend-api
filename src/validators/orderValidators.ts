import { z } from 'zod';

export const createOrderSchema = z.object({
  assetId: z.string().min(1, 'assetId is required'),
  side: z.enum(['BUY', 'SELL']),
  orderType: z.enum(['MARKET', 'LIMIT']),
  quantity: z.number().positive('Quantity must be greater than 0'),
  limitPrice: z.number().positive().optional(),
}).refine(
  (data) => data.orderType !== 'LIMIT' || typeof data.limitPrice === 'number',
  { message: 'limitPrice is required for LIMIT orders', path: ['limitPrice'] }
);

export const listOrdersQuerySchema = z.object({
  side: z.enum(['BUY', 'SELL']).optional(),
  status: z.enum(['PENDING', 'OPEN', 'FILLED', 'CANCELLED', 'REJECTED']).optional(),
  orderType: z.enum(['MARKET', 'LIMIT']).optional(),
  assetId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
