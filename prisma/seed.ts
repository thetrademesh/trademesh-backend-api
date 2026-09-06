import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@trademesh.app';
const DEMO_PASSWORD = 'demo1234';
const INITIAL_BALANCE = Number(process.env.DEMO_INITIAL_BALANCE ?? 10000);

// Same demo instruments and starting prices the frontend previously
// hard-coded — moved here so the backend is the single source of truth.
const ASSETS: Array<{
  symbol: string;
  name: string;
  type: 'STOCK' | 'CRYPTO' | 'FOREX';
  exchange?: string;
  quoteCurrency: string;
  currentPrice: number;
  change24h: number;
  volume24h: string;
}> = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', type: 'STOCK', exchange: 'NSE', quoteCurrency: 'INR', currentPrice: 2946.30, change24h: 1.24, volume24h: '4.2M' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', type: 'STOCK', exchange: 'NSE', quoteCurrency: 'INR', currentPrice: 3812.55, change24h: -0.42, volume24h: '1.8M' },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK', exchange: 'NASDAQ', quoteCurrency: 'USD', currentPrice: 228.14, change24h: 0.87, volume24h: '62.1M' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'STOCK', exchange: 'NASDAQ', quoteCurrency: 'USD', currentPrice: 241.90, change24h: 3.15, volume24h: '98.4M' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', type: 'STOCK', exchange: 'NSE', quoteCurrency: 'INR', currentPrice: 1682.10, change24h: -0.18, volume24h: '3.1M' },

  { symbol: 'BTC/USDT', name: 'Bitcoin', type: 'CRYPTO', quoteCurrency: 'USDT', currentPrice: 67240.15, change24h: 2.31, volume24h: '$28.4B' },
  { symbol: 'ETH/USDT', name: 'Ethereum', type: 'CRYPTO', quoteCurrency: 'USDT', currentPrice: 3412.80, change24h: 1.65, volume24h: '$14.1B' },
  { symbol: 'SOL/USDT', name: 'Solana', type: 'CRYPTO', quoteCurrency: 'USDT', currentPrice: 168.42, change24h: -1.02, volume24h: '$3.8B' },
  { symbol: 'BNB/USDT', name: 'BNB', type: 'CRYPTO', quoteCurrency: 'USDT', currentPrice: 612.55, change24h: 0.54, volume24h: '$1.2B' },
  { symbol: 'DOGE/USDT', name: 'Dogecoin', type: 'CRYPTO', quoteCurrency: 'USDT', currentPrice: 0.1842, change24h: 4.87, volume24h: '$980M' },

  { symbol: 'EUR/USD', name: 'Euro / US Dollar', type: 'FOREX', quoteCurrency: 'USD', currentPrice: 1.0847, change24h: -0.12, volume24h: '$102B' },
  { symbol: 'USD/INR', name: 'Dollar / Rupee', type: 'FOREX', quoteCurrency: 'INR', currentPrice: 83.42, change24h: 0.08, volume24h: '$18B' },
  { symbol: 'GBP/USD', name: 'Pound / Dollar', type: 'FOREX', quoteCurrency: 'USD', currentPrice: 1.2683, change24h: 0.21, volume24h: '$64B' },
  { symbol: 'USD/JPY', name: 'Dollar / Yen', type: 'FOREX', quoteCurrency: 'JPY', currentPrice: 151.24, change24h: -0.35, volume24h: '$88B' },
];

async function seedAssets() {
  for (const a of ASSETS) {
    await prisma.asset.upsert({
      where: { symbol: a.symbol },
      create: {
        symbol: a.symbol,
        name: a.name,
        type: a.type,
        exchange: a.exchange,
        quoteCurrency: a.quoteCurrency,
        currentPrice: a.currentPrice,
        previousPrice: a.currentPrice,
        change24h: a.change24h,
        volume24h: a.volume24h,
      },
      update: {
        name: a.name,
        exchange: a.exchange,
        quoteCurrency: a.quoteCurrency,
      },
    });
  }
  console.log(`Seeded ${ASSETS.length} demo assets.`);
}

async function seedDemoUser() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log('Demo user already exists, skipping user creation.');
    return existing;
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      fullName: 'Demo User',
      email: DEMO_EMAIL,
      passwordHash,
      country: 'India',
      role: 'USER',
      status: 'ACTIVE',
      wallet: {
        create: { currency: 'INR', availableBalance: INITIAL_BALANCE },
      },
      watchlists: {
        create: { name: 'Default' },
      },
      kycProfile: {
        create: { status: 'NOT_STARTED' },
      },
      notifications: {
        create: {
          type: 'SYSTEM',
          title: 'Welcome to TradeMesh (Demo)',
          message: `Demo account ready with ₹${INITIAL_BALANCE} in demo funds. No real money is involved.`,
        },
      },
    },
  });

  console.log(`Seeded demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  return user;
}

async function main() {
  const isReset = process.argv.includes('--reset');

  await seedAssets();
  await seedDemoUser();

  if (isReset) {
    // Delegate to the same reset logic the /api/demo/reset endpoint uses,
    // so `npm run reset-demo` and the in-app "Reset Demo" button behave
    // identically.
    const { resetDemoUser } = await import('../src/services/demoService');
    const result = await resetDemoUser();
    console.log(result.message);
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
