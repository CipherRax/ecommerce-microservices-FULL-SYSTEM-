import { FastifyReply, FastifyRequest } from 'fastify';
import admin from 'firebase-admin';
import { auth } from '../firebase';  // reuse your firebase.ts

// Extend request for TypeScript
declare module 'fastify' {
    interface FastifyRequest {
        user?: admin.auth.DecodedIdToken;
    }
}

export const verifyToken = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'No token provided' });
        return;
    }

    const idToken = authHeader.split('Bearer ')[1].trim();

    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        request.user = decodedToken;
    } catch (error: any) {
        console.error('Token verification failed:', error);
        const message = error.code === 'auth/id-token-expired'
            ? 'Token expired'
            : error.code === 'auth/id-token-revoked'
                ? 'Token revoked'
                : 'Invalid token';

        reply.code(401).send({ error: message });
    }
};