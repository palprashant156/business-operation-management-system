import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase } from './database/connect.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  await connectDatabase(env.MONGO_URI);
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info('api listening', { port: env.PORT, origin: env.CLIENT_ORIGIN });
  });
}

main().catch((err) => {
  logger.error('fatal startup error', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
