import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),

  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),

  demo: {
    tradingFeePercent: Number(process.env.DEMO_TRADING_FEE_PERCENT ?? 0.1),
    initialBalance: Number(process.env.DEMO_INITIAL_BALANCE ?? 10000),
    maxOrderValue: Number(process.env.DEMO_MAX_ORDER_VALUE ?? 500000),
    maxDeposit: Number(process.env.DEMO_MAX_DEPOSIT ?? 100000),
    controlsEnabled: (process.env.DEMO_CONTROLS_ENABLED ?? 'true') === 'true',
  },
};
