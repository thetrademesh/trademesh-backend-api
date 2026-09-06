import { PrismaClient } from '@prisma/client';

// Single shared Prisma instance across the app (recommended pattern for Node/Express).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
