import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshTokenExpiryDate,
} from '../utils/jwt';
import { env } from '../config/env';
import type { SignupInput, LoginInput } from '../validators/authValidators';

function sanitizeUser(user: { id: string; fullName: string; email: string; mobile: string | null; country: string | null; role: string; status: string; createdAt: Date }) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    country: user.country,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

async function createSessionAndTokens(userId: string, role: 'USER' | 'ADMIN', meta: { userAgent?: string; ipAddress?: string }) {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId, role });

  await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashToken(refreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
}

export async function signup(input: SignupInput, meta: { userAgent?: string; ipAddress?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        country: input.country,
        passwordHash,
      },
    });

    await tx.wallet.create({
      data: {
        userId: created.id,
        currency: 'INR',
        availableBalance: env.demo.initialBalance,
      },
    });

    await tx.watchlist.create({ data: { userId: created.id, name: 'Default' } });
    await tx.kycProfile.create({ data: { userId: created.id, status: 'NOT_STARTED' } });

    await tx.notification.create({
      data: {
        userId: created.id,
        type: 'SYSTEM',
        title: 'Demo Account Created',
        message: `Welcome, ${created.fullName}! ₹${env.demo.initialBalance} in demo funds has been added.`,
      },
    });

    return created;
  });

  const tokens = await createSessionAndTokens(user.id, user.role, meta);
  return { user: sanitizeUser(user), ...tokens };
}

export async function login(input: LoginInput, meta: { userAgent?: string; ipAddress?: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw ApiError.badRequest('INVALID_CREDENTIALS', 'Invalid email or password.');

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) throw ApiError.badRequest('INVALID_CREDENTIALS', 'Invalid email or password.');

  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('This account is not active. Contact support.');
  }

  const tokens = await createSessionAndTokens(user.id, user.role, meta);
  return { user: sanitizeUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Refresh token is invalid or expired.');
  }

  const tokenHash = hashToken(refreshToken);
  const session = await prisma.session.findFirst({
    where: { userId: payload.sub, refreshTokenHash: tokenHash, revokedAt: null },
  });
  if (!session || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Account is not active.');
  }

  // Rotate refresh token: revoke old session, issue a fresh pair.
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  const tokens = await createSessionAndTokens(user.id, user.role, {});

  return { user: sanitizeUser(user), ...tokens };
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.session.updateMany({
    where: { refreshTokenHash: tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found.');
  return sanitizeUser(user);
}

export { sanitizeUser };
