import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { MpesaService } from './services/mpesa.service';
import { verifyToken } from './middleware/auth';
import { TransactionRepository } from './repositories/transaction.repository';

const fastify = Fastify({
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty' }
            : undefined
    },
    bodyLimit: 1048576
});

// Security middleware
fastify.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-frontend-domain.com']
        : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

fastify.register(fastifyHelmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
});

// Request logging
fastify.addHook('preHandler', (request, reply, done) => {
    const logData = {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent']
    };

    if (process.env.NODE_ENV === 'development') {
        console.log('📥 Request:', logData);
    }
    done();
});

const mpesaService = new MpesaService();
const transactionRepo = new TransactionRepository();

// ========== HEALTH ENDPOINTS ==========
fastify.get('/health', async () => {
    const mpesaHealthy = await mpesaService.healthCheck();

    return {
        status: mpesaHealthy ? 'healthy' : 'degraded',
        service: 'payment',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        mpesa: mpesaHealthy ? 'connected' : 'disconnected'
    };
});

fastify.get('/health/mpesa', async () => {
    try {
        const healthy = await mpesaService.healthCheck();
        return {
            healthy,
            environment: process.env.MPESA_ENVIRONMENT,
            timestamp: new Date().toISOString()
        };
    } catch (error: any) {
        return {
            healthy: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
});

// ========== PAYMENT ENDPOINTS ==========
fastify.post('/api/payments/mpesa/stkpush',
    { preHandler: verifyToken },
    async (request, reply) => {
        const body = request.body as any;
        const user = (request as any).user;

        try {
            // Validate request
            if (!body.phone || !body.amount || !body.orderId) {
                reply.code(400);
                return {
                    success: false,
                    error: 'Missing required fields: phone, amount, orderId'
                };
            }

            // Initiate payment
            const result = await mpesaService.initiateSTKPush({
                phone: body.phone,
                amount: body.amount,
                orderId: body.orderId,
                description: body.description,
                accountReference: body.accountReference
            });

            // Log successful initiation
            console.log('Payment initiated:', {
                userId: user.uid,
                orderId: body.orderId,
                amount: body.amount,
                checkoutRequestId: result.checkoutRequestId,
                environment: process.env.MPESA_ENVIRONMENT
            });

            return {
                success: true,
                data: result,
                message: 'Payment initiated successfully. Check your phone for M-Pesa prompt.'
            };

        } catch (error: any) {
            console.error('Payment initiation failed:', {
                userId: user?.uid,
                orderId: body.orderId,
                error: error.message
            });

            reply.code(error.message.includes('Invalid') ? 400 : 500);
            return {
                success: false,
                error: error.message,
                code: 'PAYMENT_INITIATION_FAILED'
            };
        }
    }
);

// ========== TRANSACTION ENDPOINTS ==========
fastify.get('/api/payments/transactions/:orderId',
    { preHandler: verifyToken },
    async (request, reply) => {
        const { orderId } = request.params as any;
        const user = (request as any).user;

        try {
            const transactions = await transactionRepo.findByOrderId(orderId);

            // Optional: Verify user owns this order
            // const order = await orderService.getOrder(orderId);
            // if (order.userId !== user.uid) {
            //     reply.code(403);
            //     return { success: false, error: 'Unauthorized' };
            // }

            return {
                success: true,
                data: transactions
            };
        } catch (error: any) {
            console.error('Get transactions error:', error);
            reply.code(500);
            return {
                success: false,
                error: 'Failed to fetch transactions'
            };
        }
    }
);

fastify.post('/api/payments/transactions/query',
    { preHandler: verifyToken },
    async (request, reply) => {
        const body = request.body as { checkoutRequestId: string };
        const user = (request as any).user;

        try {
            if (!body.checkoutRequestId) {
                reply.code(400);
                return { success: false, error: 'checkoutRequestId is required' };
            }

            const result = await mpesaService.queryTransaction(body.checkoutRequestId);

            return {
                success: true,
                data: result
            };
        } catch (error: any) {
            console.error('Query transaction error:', error);
            reply.code(500);
            return {
                success: false,
                error: 'Failed to query transaction status'
            };
        }
    }
);

// ========== CALLBACK ENDPOINT ==========
fastify.post('/api/payments/mpesa/callback', async (request, reply) => {
    const callback = request.body as any;

    try {
        // Log callback for debugging
        console.log('🔔 M-Pesa Callback:', {
            timestamp: new Date().toISOString(),
            callbackType: callback?.Body?.stkCallback ? 'STK' : 'Other',
            data: callback
        });

        if (callback.Body?.stkCallback) {
            const stkCallback = callback.Body.stkCallback;
            const resultCode = stkCallback.ResultCode;

            // Find transaction
            const transaction = await transactionRepo.findByCheckoutRequestId(
                stkCallback.CheckoutRequestID
            );

            if (transaction) {
                // Update transaction with callback data
                await transactionRepo.updateTransaction(
                    stkCallback.CheckoutRequestID,
                    {
                        status: resultCode === '0' ? 'completed' : 'failed',
                        resultCode: resultCode.toString(),
                        resultDescription: stkCallback.ResultDesc,
                        callbackData: callback
                    }
                );

                // Extract payment details if successful
                if (resultCode === '0' && stkCallback.CallbackMetadata?.Item) {
                    const items = stkCallback.CallbackMetadata.Item;
                    const updateData: any = {};

                    items.forEach((item: any) => {
                        if (item.Name === 'Amount') updateData.amount = item.Value;
                        if (item.Name === 'MpesaReceiptNumber') updateData.mpesaReceiptNumber = item.Value;
                        if (item.Name === 'TransactionDate') updateData.transactionDate = item.Value;
                        if (item.Name === 'PhoneNumber') updateData.phone = item.Value;
                    });

                    await transactionRepo.updateTransaction(
                        stkCallback.CheckoutRequestID,
                        updateData
                    );

                    // TODO: Update order status to paid
                    // await orderService.markAsPaid(transaction.orderId, {
                    //     mpesaReceiptNumber: updateData.mpesaReceiptNumber,
                    //     transactionDate: updateData.transactionDate
                    // });
                }

                // TODO: Send webhook/notification to order service
                // await webhookService.sendPaymentUpdate({
                //     orderId: transaction.orderId,
                //     status: resultCode === '0' ? 'paid' : 'failed',
                //     checkoutRequestId: stkCallback.CheckoutRequestID,
                //     mpesaReceiptNumber: resultCode === '0' ? updateData.mpesaReceiptNumber : null
                // });
            }

            console.log(`Callback processed: ${stkCallback.CheckoutRequestID} - Result: ${resultCode}`);
        }

        // Always return success to M-Pesa
        return {
            ResultCode: 0,
            ResultDesc: 'Success'
        };

    } catch (error) {
        console.error('Callback processing error:', error);

        // Still return success to M-Pesa (they'll retry if needed)
        return {
            ResultCode: 0,
            ResultDesc: 'Success'
        };
    }
});

// ========== ERROR HANDLING ==========
fastify.setErrorHandler((error, request, reply) => {
    console.error('Unhandled error:', {
        method: request.method,
        url: request.url,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    const statusCode = error.statusCode || 500;
    const message = statusCode === 500
        ? 'Internal server error'
        : error.message;

    reply.status(statusCode).send({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// ========== START SERVER ==========
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3003');
        const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

        await fastify.listen({ port, host });

        console.log(`
        🚀 Payment Service Started!
        📍 Environment: ${process.env.NODE_ENV}
        💰 M-Pesa Mode: ${process.env.MPESA_ENVIRONMENT}
        🌐 Server: http://${host}:${port}
        🕐 Time: ${new Date().toISOString()}
        
        Available Endpoints:
        GET    /health
        GET    /health/mpesa
        POST   /api/payments/mpesa/stkpush (protected)
        GET    /api/payments/transactions/:orderId (protected)
        POST   /api/payments/transactions/query (protected)
        POST   /api/payments/mpesa/callback (public - for M-Pesa)
        `);

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

start();