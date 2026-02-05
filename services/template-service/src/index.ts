import Fastify from 'fastify';
import { config, logger } from '@ecommerce/common';

export async function buildServer() {
  const server = Fastify({
    logger: false, // We use our own logger
    disableRequestLogging: true,
  });

  // Register plugins
  await server.register(import('@fastify/helmet'));
  await server.register(import('@fastify/cors'), {
    origin: config.isProduction
      ? process.env.ALLOWED_ORIGINS?.split(',')
      : true,
    credentials: true,
  });

  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME
    };
  });

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await server.close();
      process.exit(0);
    });
  });

  return server;
}

// Start server if this file is run directly
if (require.main === module) {
  (async () => {
    try {
      const server = await buildServer();
      const port = config.port;

      await server.listen({
        port,
        host: '0.0.0.0'
      });

      logger.info(`Service started on port ${port}`);
    } catch (err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }
  })();
}
