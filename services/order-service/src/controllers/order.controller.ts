import type { FastifyRequest, FastifyReply } from 'fastify';
import { OrderService } from '../services/order.service';
import { CreateOrderSchema, UpdateOrderStatusSchema } from '../types/order.types';

export class OrderController {
    private orderService: OrderService;

    constructor() {
        this.orderService = new OrderService();
    }

    // ========== CREATE ==========
    createOrder = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const validation = CreateOrderSchema.safeParse(request.body);

            if (!validation.success) {
                return reply.code(400).send({
                    success: false,
                    error: 'Validation failed',
                    details: validation.error.errors
                });
            }

            const order = await this.orderService.createOrder(validation.data);

            return reply.code(201).send({
                success: true,
                data: order,
                message: 'Order created successfully'
            });
        } catch (error: any) {
            console.error('Create order error:', error);

            return reply.code(400).send({
                success: false,
                error: error.message || 'Failed to create order'
            });
        }
    };

    // ========== READ ==========
    getOrder = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as { id: string };
            const user = (request as any).user;

            const order = await this.orderService.getOrder(id);

            if (!order) {
                return reply.code(404).send({
                    success: false,
                    error: 'Order not found'
                });
            }

            // Verify user owns this order (or is admin)
            if (order.userId !== user.uid && !user.isAdmin) {
                return reply.code(403).send({
                    success: false,
                    error: 'Access denied'
                });
            }

            return reply.send({
                success: true,
                data: order
            });
        } catch (error: any) {
            console.error('Get order error:', error);

            return reply.code(500).send({
                success: false,
                error: 'Failed to fetch order'
            });
        }
    };

    getUserOrders = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const user = (request as any).user;
            const { limit = '20', cursor } = request.query as any;

            const orders = await this.orderService.getUserOrders(
                user.uid,
                parseInt(limit),
                cursor
            );

            return reply.send({
                success: true,
                ...orders
            });
        } catch (error: any) {
            console.error('Get user orders error:', error);

            return reply.code(500).send({
                success: false,
                error: 'Failed to fetch orders'
            });
        }
    };

    // ========== UPDATE ==========
    updateOrderStatus = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as { id: string };
            const user = (request as any).user;

            // Check admin permissions
            if (!user.isAdmin) {
                return reply.code(403).send({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const validation = UpdateOrderStatusSchema.safeParse(request.body);

            if (!validation.success) {
                return reply.code(400).send({
                    success: false,
                    error: 'Validation failed',
                    details: validation.error.errors
                });
            }

            const order = await this.orderService.updateOrderStatus(
                id,
                validation.data.status,
                validation.data.reason
            );

            return reply.send({
                success: true,
                data: order,
                message: `Order status updated to ${validation.data.status}`
            });
        } catch (error: any) {
            console.error('Update order status error:', error);

            return reply.code(400).send({
                success: false,
                error: error.message || 'Failed to update order status'
            });
        }
    };

    cancelOrder = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = request.params as { id: string };
            const user = (request as any).user;
            const { reason } = request.body as { reason: string };

            const order = await this.orderService.cancelOrder(id, reason, user.uid);

            return reply.send({
                success: true,
                data: order,
                message: 'Order cancelled successfully'
            });
        } catch (error: any) {
            console.error('Cancel order error:', error);

            return reply.code(400).send({
                success: false,
                error: error.message || 'Failed to cancel order'
            });
        }
    };

    // ========== PAYMENT CALLBACKS ==========
    handlePaymentWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { event, data } = request.body as any;

            switch (event) {
                case 'payment.success':
                    await this.orderService.processPayment(data.orderId, {
                        transactionId: data.transactionId,
                        amount: data.amount,
                        method: data.method,
                        receipt: data.receipt
                    });
                    break;

                case 'payment.failed':
                    await this.orderService.updateOrderStatus(
                        data.orderId,
                        'failed',
                        'Payment failed'
                    );
                    break;
            }

            return reply.send({ received: true });
        } catch (error: any) {
            console.error('Payment webhook error:', error);

            return reply.code(500).send({
                success: false,
                error: 'Failed to process webhook'
            });
        }
    };

    // ========== ANALYTICS ==========
    getOrderAnalytics = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const user = (request as any).user;

            // Admin only
            if (!user.isAdmin) {
                return reply.code(403).send({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const { userId, dateFrom, dateTo } = request.query as any;

            const analytics = await this.orderService.getOrderAnalytics(userId, {
                from: dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                to: dateTo ? new Date(dateTo) : new Date()
            });

            return reply.send({
                success: true,
                data: analytics
            });
        } catch (error: any) {
            console.error('Order analytics error:', error);

            return reply.code(500).send({
                success: false,
                error: 'Failed to fetch analytics'
            });
        }
    };
}