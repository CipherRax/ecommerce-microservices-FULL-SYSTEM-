import { User } from '@ecommerce/types';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    requestId: string;
  }
}
