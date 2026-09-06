import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { createNotification } from './notificationService';

// IMPORTANT: This service intentionally performs no real identity
// verification. It only stores the state of a clearly-labeled DEMO
// KYC workflow (matching the frontend's 3-step demo flow). No real
// PAN/Aadhaar/Passport documents are validated, checked, or required.

export async function getKyc(userId: string) {
  const profile = await prisma.kycProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('KYC profile not found.');
  return profile;
}

export async function submitKyc(
  userId: string,
  input: { fullName: string; dateOfBirth: string; country: string; address: string; documentType: string }
) {
  return prisma.kycProfile.upsert({
    where: { userId },
    create: { userId, ...input, status: 'PENDING', submittedAt: new Date() },
    update: { ...input, status: 'PENDING', submittedAt: new Date() },
  });
}

/** Demo-only "verification" — flips status to VERIFIED with no real check performed. */
export async function demoVerifyKyc(userId: string) {
  const profile = await prisma.kycProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('KYC profile not found. Submit KYC details first.');

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.kycProfile.update({
      where: { userId },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
    await createNotification(
      tx,
      userId,
      'KYC',
      'KYC Status Update',
      'Demo KYC verification completed. This is a simulated check, not a real identity verification.'
    );
    return result;
  });

  return updated;
}
