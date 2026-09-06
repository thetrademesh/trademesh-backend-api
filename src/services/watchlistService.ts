import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';

async function getOrCreateDefaultWatchlist(userId: string) {
  let watchlist = await prisma.watchlist.findFirst({ where: { userId } });
  if (!watchlist) {
    watchlist = await prisma.watchlist.create({ data: { userId, name: 'Default' } });
  }
  return watchlist;
}

export async function listWatchlists(userId: string) {
  const watchlist = await getOrCreateDefaultWatchlist(userId);
  const items = await prisma.watchlistItem.findMany({
    where: { watchlistId: watchlist.id },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
  });
  return { id: watchlist.id, name: watchlist.name, items };
}

export async function addToWatchlist(userId: string, assetId: string) {
  const watchlist = await getOrCreateDefaultWatchlist(userId);
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw ApiError.notFound('Asset not found.');

  return prisma.watchlistItem.upsert({
    where: { watchlistId_assetId: { watchlistId: watchlist.id, assetId } },
    create: { watchlistId: watchlist.id, assetId },
    update: {},
  });
}

export async function removeFromWatchlist(userId: string, assetId: string) {
  const watchlist = await getOrCreateDefaultWatchlist(userId);
  await prisma.watchlistItem.deleteMany({ where: { watchlistId: watchlist.id, assetId } });
}
