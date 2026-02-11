import 'dotenv/config';
import Fastify from 'fastify';
import { MpesaService } from './mpesa-helper';
import { verifyToken } from './middleware/auth';

const fastify = Fastify({
    logger: true,
    bodyLimit: 1048576 // 1MB
});

// Request logging middleware
fastify.addHook('preHandler', (request, reply, done) => {
    console.log(`${request.method} ${request.url}`, request.body);
    done();
});

// CORS setup
fastify.register(import('@fastify/cors'), {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

fastify.get('/health', async () => ({
    status: 'ok',
    service: 'payment',
    timestamp: new Date().toISOString()
}));

// Simple token test (public)
fastify.get('/mpesa/token-test', async () => {
    try {
        const mpesaService = new MpesaService();
        const token = await mpesaService.getAccessToken();

        return {
            success: true,
            token: token.substring(0, 30) + '...',
            length: token.length,
            timestamp: new Date().toISOString()
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
});

// Public test endpoint (no auth required)
fastify.post('/mpesa/test-payment', async (request, reply) => {
    try {
        const body = request.body as any;

        // Validate
        if (!body.phone || !body.amount || !body.orderId) {
            reply.code(400);
            return {
                success: false,
                error: 'Missing required fields: phone, amount, orderId'
            };
        }

        // Clean phone - use test number for sandbox
        const phone = '254708374149'; // Always use test number for sandbox

        const mpesaService = new MpesaService();
        const result = await mpesaService.initiateSTKPush(
            phone,
            Number(body.amount),
            body.orderId
        );

        return {
            success: true,
            data: result,
            message: `STK Push sent to ${phone}. Check your phone.`
        };
    } catch (error: any) {
        console.error('Payment error:', error);

        reply.code(500);
        return {
            success: false,
            error: error.message,
            details: error.response?.data,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    }
});

// Protected endpoint (with auth)
fastify.post('/mpesa/stkpush', { preHandler: verifyToken }, async (request, reply) => {
    try {
        const body = request.body as any;
        const user = (request as any).user; // From verifyToken middleware

        console.log('Payment request from user:', user?.uid, 'body:', body);

        // Validate
        if (!body.phone || !body.amount || !body.orderId) {
            reply.code(400);
            return {
                success: false,
                error: 'Missing required fields'
            };
        }

        // Clean phone number
        const phone = body.phone.toString().replace(/\D/g, '');
        if (!phone.startsWith('254') || phone.length !== 12) {
            reply.code(400);
            return {
                success: false,
                error: 'Phone must be 12 digits starting with 254'
            };
        }

        const mpesaService = new MpesaService();
        const result = await mpesaService.initiateSTKPush(
            phone,
            Number(body.amount),
            body.orderId
        );

        return {
            success: true,
            data: result,
            message: 'Payment initiated successfully'
        };
    } catch (error: any) {
        console.error('Protected payment error:', error);

        const statusCode = error.response?.status || 500;
        reply.code(statusCode);

        return {
            success: false,
            error: error.response?.data?.errorMessage || 'Payment failed',
            details: error.response?.data || error.message
        };
    }
});

// Callback endpoint
fastify.post('/mpesa/callback', async (request, reply) => {
    const callback = request.body;
    console.log('MPesa Callback:', JSON.stringify(callback, null, 2));

    // Process the callback
    // TODO: Update order status in database

    return {
        ResultCode: 0,
        ResultDesc: 'Success'
    };
});

// Error handler
fastify.setErrorHandler((error: any, request, reply) => {
    console.error('Global error:', error);

    reply.status(error.statusCode || 500).send({
        success: false,
        error: error.message || 'Internal server error'
    });
});

const start = async () => {
    try {
        await fastify.listen({
            port: 3003,
            host: '0.0.0.0'
        });
        console.log(`
        🚀 Payment service running!
        📍 Local: http://localhost:3003
        🌐 Public: https://presutural-brecken-mandibular.ngrok-free.dev
        
        Available endpoints:
        GET  /health
        GET  /mpesa/token-test
        POST /mpesa/test-payment (no auth)
        POST /mpesa/stkpush (requires auth)
        POST /mpesa/callback (for Daraja)
        `);
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

start();