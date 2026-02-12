import axios from 'axios';
import { OrderRepository } from '../repositories/order.repository';
import type {
    Order,
    CreateOrderRequest,
    OrderStatus,
    PaymentStatus,
    ShippingStatus,
    Address
} from '../types/order.types';

export class OrderService {
    private orderRepo: OrderRepository;

    constructor() {
        this.orderRepo = new OrderRepository();
    }

    // ========== CREATE ==========
    async createOrder(request: CreateOrderRequest): Promise<Order> {
        try {
            // 1. Validate inventory/stock
            await this.validateInventory(request.items);

            // 2. Calculate totals (double-check)
            const calculated = this.calculateTotals(request);

            // 3. Create order
            const order = await this.orderRepo.create({
                ...request,
                subtotal: calculated.subtotal,
                total: calculated.total,
                billingAddress: request.billingAddress || request.shippingAddress,
                metadata: {
                    userAgent: request.metadata?.userAgent,
                    ip: request.metadata?.ip,
                    source: 'web'
                }
            });

            // 4. Reserve inventory
            await this.reserveInventory(order.id, request.items);

            // 5. Send order created event
            await this.publishOrderCreated(order);

            // 6. Send confirmation email (async)
            this.sendOrderConfirmation(order).catch(console.error);

            return order;
        } catch (error) {
            console.error('Create order error:', error);
            throw error;
        }
    }

    // ========== READ ==========
    async getOrder(orderId: string): Promise<Order | null> {
        return this.orderRepo.findById(orderId);
    }

    async getOrderByNumber(orderNumber: string): Promise<Order | null> {
        return this.orderRepo.findByOrderNumber(orderNumber);
    }

    async getUserOrders(userId: string, limit = 20, cursor?: string): Promise<any> {
        const orders = await this.orderRepo.findByUser(userId, limit, cursor);

        return {
            orders,
            nextCursor: orders.length === limit ? orders[orders.length - 1].id : null,
            total: orders.length
        };
    }

    // ========== UPDATE ==========
    async updateOrderStatus(orderId: string, status: OrderStatus, reason?: string): Promise<Order> {
        const order = await this.orderRepo.findById(orderId);
        if (!order) throw new Error('Order not found');

        // Validate status transition
        this.validateStatusTransition(order.status, status);

        await this.orderRepo.updateStatus(orderId, status, reason);

        // Publish status change event
        await this.publishOrderStatusChanged(orderId, status, reason);

        return (await this.orderRepo.findById(orderId))!;
    }

    async processPayment(orderId: string, paymentData: {
        transactionId: string;
        amount: number;
        method: string;
        receipt?: string;
    }): Promise<Order> {
        const order = await this.orderRepo.findById(orderId);
        if (!order) throw new Error('Order not found');

        await this.orderRepo.updatePaymentStatus(orderId, 'paid', {
            paymentTransactionId: paymentData.transactionId,
            paymentReceipt: paymentData.receipt,
            paidAt: new Date()
        });

        // Update order status if needed
        if (order.status === 'pending') {
            await this.orderRepo.updateStatus(orderId, 'confirmed');
        }

        // Release inventory confirmation
        await this.confirmInventoryReservation(orderId, order.items);

        return (await this.orderRepo.findById(orderId))!;
    }

    async cancelOrder(orderId: string, reason: string, cancelledBy: string): Promise<Order> {
        const order = await this.orderRepo.findById(orderId);
        if (!order) throw new Error('Order not found');

        // Check if cancellable
        if (!['pending', 'confirmed'].includes(order.status)) {
            throw new Error('Order cannot be cancelled at this stage');
        }

        await this.orderRepo.update(orderId, {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: cancelledBy,
            cancellationReason: reason
        });

        // Release inventory
        await this.releaseInventory(orderId, order.items);

        // Process refund if payment was made
        if (order.paymentStatus === 'paid') {
            await this.initiateRefund(order);
        }

        return (await this.orderRepo.findById(orderId))!;
    }

    // ========== VALIDATION ==========
    private async validateInventory(items: any[]): Promise<void> {
        try {
            // Call inventory service
            const response = await axios.post(
                `${process.env.INVENTORY_SERVICE_URL}/api/inventory/validate`,
                { items }
            );

            if (!response.data.valid) {
                throw new Error(`Inventory validation failed: ${response.data.message}`);
            }
        } catch (error) {
            console.error('Inventory validation error:', error);
            throw new Error('Failed to validate inventory');
        }
    }

    private validateStatusTransition(current: OrderStatus, next: OrderStatus): void {
        const validTransitions: Record<OrderStatus, OrderStatus[]> = {
            pending: ['confirmed', 'cancelled', 'failed'],
            confirmed: ['processing', 'cancelled', 'refunded'],
            processing: ['shipped', 'cancelled'],
            shipped: ['delivered', 'cancelled'],
            delivered: ['refunded'],
            cancelled: [],
            refunded: [],
            failed: ['pending', 'cancelled']
        };

        if (!validTransitions[current].includes(next)) {
            throw new Error(`Cannot transition from ${current} to ${next}`);
        }
    }

    // ========== BUSINESS LOGIC ==========
    private calculateTotals(request: CreateOrderRequest): {
        subtotal: number;
        total: number;
    } {
        const subtotal = request.items.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        const total = subtotal + request.shippingCost - request.discount + request.tax;

        return { subtotal, total };
    }

    // ========== INTEGRATIONS ==========
    private async reserveInventory(orderId: string, items: any[]): Promise<void> {
        try {
            await axios.post(
                `${process.env.INVENTORY_SERVICE_URL}/api/inventory/reserve`,
                {
                    orderId,
                    items
                }
            );
        } catch (error) {
            console.error('Inventory reservation error:', error);
            // Don't throw - order can still proceed, but we need to handle this
        }
    }

    private async confirmInventoryReservation(orderId: string, items: any[]): Promise<void> {
        try {
            await axios.post(
                `${process.env.INVENTORY_SERVICE_URL}/api/inventory/confirm`,
                { orderId, items }
            );
        } catch (error) {
            console.error('Inventory confirmation error:', error);
        }
    }

    private async releaseInventory(orderId: string, items: any[]): Promise<void> {
        try {
            await axios.post(
                `${process.env.INVENTORY_SERVICE_URL}/api/inventory/release`,
                { orderId, items }
            );
        } catch (error) {
            console.error('Inventory release error:', error);
        }
    }

    private async initiateRefund(order: Order): Promise<void> {
        try {
            await axios.post(
                `${process.env.PAYMENT_SERVICE_URL}/api/payments/refund`,
                {
                    orderId: order.id,
                    transactionId: order.paymentTransactionId,
                    amount: order.total,
                    reason: order.cancellationReason
                }
            );
        } catch (error) {
            console.error('Refund initiation error:', error);
        }
    }

    private async sendOrderConfirmation(order: Order): Promise<void> {
        // Call notification service
        try {
            await axios.post(
                `${process.env.NOTIFICATION_SERVICE_URL}/api/notifications/email`,
                {
                    to: order.userId,
                    template: 'order-confirmation',
                    data: {
                        orderNumber: order.orderNumber,
                        items: order.items,
                        total: order.total,
                        shippingAddress: order.shippingAddress
                    }
                }
            );
        } catch (error) {
            console.error('Failed to send order confirmation:', error);
        }
    }

    private async publishOrderCreated(order: Order): Promise<void> {
        // Publish event to message queue (Kafka/RabbitMQ)
        console.log('Order created event:', order.id);
    }

    private async publishOrderStatusChanged(
        orderId: string,
        status: OrderStatus,
        reason?: string
    ): Promise<void> {
        console.log('Order status changed:', { orderId, status, reason });
    }

    // ========== ANALYTICS ==========
    async getOrderAnalytics(userId?: string, dateRange?: { from: Date; to: Date }): Promise<any> {
        return this.orderRepo.getOrderStats(userId);
    }
}