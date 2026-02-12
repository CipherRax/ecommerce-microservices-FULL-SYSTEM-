import { FastifyRequest, FastifyReply } from 'fastify';
import { AnyZodObject } from 'zod';

export const validate = (schema: AnyZodObject) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            await schema.parseAsync({
                body: request.body,
                query: request.query,
                params: request.params
            });
        } catch (error) {
            return reply.code(400).send({
                success: false,
                error: 'Validation failed',
                details: error
            });
        }
    };
};

export const validateOrderOwnership = async (
    request: FastifyRequest,
    reply: FastifyReply
) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    // Admins can access any order
    if (user.isAdmin) {
        return;
    }

    // Check if user owns this order
    // This would need to query the order service
    // For now, we'll assume the controller handles this
};