import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@ecommerce/common';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.requestId = uuidv4();

    logger.info('Incoming request', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info('Request completed', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
    });
  });
};
