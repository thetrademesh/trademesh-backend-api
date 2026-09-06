import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

async function main() {
  const app = createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`TradeMesh backend (DEMO mode) listening on http://localhost:${env.port}`);
    // eslint-disable-next-line no-console
    console.log(`Health check: http://localhost:${env.port}/api/health`);
  });

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log('Shutting down gracefully...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}


main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
export default app;
