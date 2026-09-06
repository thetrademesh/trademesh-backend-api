import { z } from 'zod';

export const kycSubmitSchema = z.object({
  fullName: z.string().trim().min(2),
  dateOfBirth: z.string().trim().min(1),
  country: z.string().trim().min(1),
  address: z.string().trim().min(1),
  documentType: z.enum(['PAN', 'AADHAAR', 'PASSPORT']),
});
