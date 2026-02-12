import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { verifyToken, requireAdmin } from './middleware/auth';
import { OrderController } from './controllers/order.controller';

const fastify = Fastify({
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty' }
            : undefined
    },
    bodyLimit: 1048576 // 1MB
});

// ========== PLUGINS ==========
await fastify.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-domain.com']
        : '*',
    credentials: true
});

await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
});

await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute'
});

// ========== CONTROLLERS ==========
const orderController = new OrderController();

// ========== HEALTH ==========
fastify.get('/health', async () => ({
    status: 'healthy',
    service: 'order',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
}));

// ========== ORDER ROUTES ==========
const orderRoutes = async () => {
    // Protected routes (require auth)
    fastify.post('/api/orders', {
        preHandler: [verifyToken],
        handler: orderController.createOrder
    });

    fastify.get('/api/orders/my-orders', {
        preHandler: [verifyToken],
        handler: orderController.getUserOrders
    });

    fastify.get('/api/orders/:id', {
        preHandler: [verifyToken],
        handler: orderController.getOrder
    });

    fastify.patch('/api/orders/:id/cancel', {
        preHandler: [verifyToken],
        handler: orderController.cancelOrder
    });

    // Admin routes
    fastify.patch('/api/admin/orders/:id/status', {
        preHandler: [verifyToken, requireAdmin],
        handler: orderController.updateOrderStatus
    });

    fastify.get('/api/admin/orders/analytics', {
        preHandler: [verifyToken, requireAdmin],
        handler: orderController.getOrderAnalytics
    });

    // Webhooks (public, no auth)
    fastify.post('/api/webhooks/payment', {
        handler: orderController.handlePaymentWebhook
    });
};

await orderRoutes();

// ========== ERROR HANDLER ==========
fastify.setErrorHandler((error, request, reply) => {
    console.error('Unhandled error:', {
        url: request.url,
        method: request.method,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    reply.status(error.statusCode || 500).send({
        success: false,
        error: error.message || 'Internal server error'
    });
});

// ========== START ==========
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3002');
        const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

        await fastify.listen({ port, host });

        console.log(`
    🛒 Order Service Started!
    📍 Environment: ${process.env.NODE_ENV}
    🌐 Server: http://${host}:${port}
    🕐 Time: ${new Date().toISOString()}
    
    Available Endpoints:
    GET    /health
    POST   /api/orders (auth)
    GET    /api/orders/my-orders (auth)
    GET    /api/orders/:id (auth)
    PATCH  /api/orders/:id/cancel (auth)
    PATCH  /api/admin/orders/:id/status (admin)
    GET    /api/admin/orders/analytics (admin)
    POST   /api/webhooks/payment (public)
    `);

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

start();