import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config, logger } from '@ecommerce/common/src';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHadler';

export async function buildServer(): Promise<FastifyInstance> {
  const server: FastifyInstance = Fastify({
    logger: false,
    disableRequestLogging: true,
    trustProxy: config.isProduction,
    requestIdHeader: 'x-request-id',
    genReqId: (req) => req.headers['x-request-id'] as string || '',
  });

  // Register core plugins
  await server.register(helmet, {
    contentSecurityPolicy: config.isProduction,
  });

  await server.register(cors, {
    origin: config.isProduction && process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await server.register(rateLimit, {
    max: config.isProduction ? 100 : 1000,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', 'localhost'],
    keyGenerator: (req) => req.headers['x-forwarded-for'] as string || req.ip,
  });

  // Register custom middleware
  await server.register(requestLogger);
  await server.register(errorHandler);

  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  });

  server.get('/ready', async () => {
    // Add database/redis health checks here
    return {
      status: 'READY',
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
    };
  });

  return server;
}

export async function startServer(): Promise<void> {
  try {
    const server = await buildServer();
    const port = parseInt(process.env.PORT || '3000', 10);

    await server.listen({
      port,
      host: '0.0.0.0',
    });

    logger.info(`Server started successfully`, {
      service: process.env.SERVICE_NAME,
      port,
      environment: config.env,
      nodeVersion: process.version,
    });

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`, {
          signal,
        });

        try {
          await server.close();
          logger.info('Server closed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
