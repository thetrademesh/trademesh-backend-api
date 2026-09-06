import { z } from 'zod';
import { env } from '../config/env';

export const demoDepositSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(env.demo.maxDeposit, `Amount cannot exceed the demo maximum of ${env.demo.maxDeposit}`),
});

export const demoWithdrawalSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  destination: z.string().trim().min(3, 'Enter a destination (bank account / crypto address)'),
});
