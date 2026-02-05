import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, logger } from '@ecommerce/common';

export const errorHandler: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId;

    // Log the error
    logger.error('Error occurred', {
      requestId,
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    // Handle known AppError
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
        requestId,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      });
    }

    // Handle validation errors
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: error.validation,
        requestId,
      });
    }

    // Default error response
    const statusCode = (error as any).statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;

    return reply.status(statusCode).send({
      success: false,
      error: message,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });
};
