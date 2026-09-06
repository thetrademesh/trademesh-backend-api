import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import apiRoutes from './routes/index';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';

export function createApp() {
  const app = express();

  // Security headers. Disabled CSP here since this backend serves JSON only —
  // the static frontend is expected to be served separately (or via a simple
  // static server) with its own CSP if needed.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(generalLimiter);

  // Lightweight request log — no sensitive data (no bodies, no tokens).
  app.use((req, _res, next) => {
    // eslint-disable-next-line no-console
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'TradeMesh Backend',
        mode: 'DEMO / SIMULATED TRADING ENVIRONMENT',
        docs: '/api/health',
      },
    });
  });

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
