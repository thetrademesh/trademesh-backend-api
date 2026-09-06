import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { Prisma } from '@prisma/client';

// ===================== MarketDataProvider abstraction =====================
//
// The rest of the app talks to "a market data provider" through this
// interface. Today it's backed by MockMarketDataProvider (demo prices
// stored in our own DB). A real provider (e.g. a licensed market-data
// vendor) could implement the same interface later without touching
// any calling code.

export interface MarketDataProvider {
  getAssets(filter?: { type?: string; search?: string }): Promise<any[]>;
  getQuote(assetId: string): Promise<any>;
  getQuotes(assetIds: string[]): Promise<any[]>;
  getHistory(assetId: string): Promise<{ t: number; price: number }[]>;
}

class MockMarketDataProvider implements MarketDataProvider {
  async getAssets(filter?: { type?: string; search?: string }) {
    return prisma.asset.findMany({
      where: {
        isActive: true,
        ...(filter?.type ? { type: filter.type as any } : {}),
        ...(filter?.search
          ? {
              OR: [
                { symbol: { contains: filter.search.toUpperCase() } },
                { name: { contains: filter.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { symbol: 'asc' },
    });
  }

  async getQuote(assetId: string) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw ApiError.notFound('Asset not found.');
    return asset;
  }

  async getQuotes(assetIds: string[]) {
    return prisma.asset.findMany({ where: { id: { in: assetIds } } });
  }

  async getHistory(assetId: string) {
    // Demo-only synthetic history derived deterministically from the
    // current price — clearly not a real historical price feed.
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw ApiError.notFound('Asset not found.');
    const base = Number(asset.currentPrice);
    const points: { t: number; price: number }[] = [];
    const now = Date.now();
    for (let i = 23; i >= 0; i--) {
      const wobble = Math.sin(i * 0.7) * base * 0.01;
      points.push({ t: now - i * 60 * 60 * 1000, price: Number((base + wobble).toFixed(4)) });
    }
    return points;
  }
}

export const marketDataProvider: MarketDataProvider = new MockMarketDataProvider();

export async function listAssets(filter?: { type?: string; search?: string }) {
  return marketDataProvider.getAssets(filter);
}

export async function getAssetById(assetId: string) {
  return marketDataProvider.getQuote(assetId);
}

export async function getAssetQuote(assetId: string) {
  return marketDataProvider.getQuote(assetId);
}

export async function getAssetHistory(assetId: string) {
  return marketDataProvider.getHistory(assetId);
}

export async function searchAssets(query: string) {
  if (!query || query.trim().length === 0) return [];
  return marketDataProvider.getAssets({ search: query.trim() });
}

/**
 * Controlled demo price movement. Moves price by a small bounded
 * percentage so the product still looks credible rather than erratic.
 * This is explicitly a demo/admin control, never a "live feed".
 */
export async function simulatePriceMovement(assetId: string, maxPercentMove = 0.6) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw ApiError.notFound('Asset not found.');

  const current = new Prisma.Decimal(asset.currentPrice);
  const percent = (Math.random() * 2 - 1) * maxPercentMove; // e.g. -0.6% .. +0.6%
  const delta = current.mul(percent).div(100);
  const newPrice = current.add(delta);

  const change24h = new Prisma.Decimal(asset.change24h).add(percent).toDecimalPlaces(2);

  return prisma.asset.update({
    where: { id: assetId },
    data: {
      previousPrice: asset.currentPrice,
      currentPrice: newPrice.toDecimalPlaces(assetId.includes('forex') ? 4 : 2),
      change24h,
      priceUpdatedAt: new Date(),
    },
  });
}
