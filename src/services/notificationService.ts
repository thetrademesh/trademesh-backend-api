import { prisma } from '../config/prisma';
import { Prisma, NotificationType } from '@prisma/client';

export async function createNotification(
  tx: Prisma.TransactionClient | typeof prisma,
  userId: string,
  type: NotificationType,
  title: string,
  message: string
) {
  return tx.notification.create({ data: { userId, type, title, message } });
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}
