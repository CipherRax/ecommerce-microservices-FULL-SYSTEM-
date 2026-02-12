import { firestore } from '../firebase';
import type {
    Order,
    OrderSummary,
    OrderFilters,
    OrderStatus,
    PaymentStatus,
    ShippingStatus
} from '../types/order.types';

export class OrderRepository {
    private collection = firestore.collection('orders');
    private userOrdersCollection = firestore.collection('user_orders');

    // ========== CREATE ==========
    async create(orderData: Partial<Order>): Promise<Order> {
        const orderRef = this.collection.doc();
        const timestamp = new Date();

        const order: Order = {
            id: orderRef.id,
            orderNumber: this.generateOrderNumber(),
            status: 'pending',
            paymentStatus: 'pending',
            shippingStatus: 'pending',
            currency: 'KES',
            metadata: {},
            ...orderData,
            createdAt: timestamp,
            updatedAt: timestamp
        } as Order;

        await firestore.runTransaction(async (transaction) => {
            // Create order document
            transaction.set(orderRef, order);

            // Create user order index
            const userOrderRef = this.userOrdersCollection.doc(`${order.userId}_${order.id}`);
            transaction.set(userOrderRef, {
                userId: order.userId,
                orderId: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
                total: order.total,
                createdAt: timestamp
            });
        });

        return order;
    }

    // ========== READ ==========
    async findById(id: string): Promise<Order | null> {
        const doc = await this.collection.doc(id).get();
        return doc.exists ? (doc.data() as Order) : null;
    }

    async findByOrderNumber(orderNumber: string): Promise<Order | null> {
        const snapshot = await this.collection
            .where('orderNumber', '==', orderNumber)
            .limit(1)
            .get();

        return snapshot.empty ? null : (snapshot.docs[0].data() as Order);
    }

    async findByUser(userId: string, limit = 20, startAfter?: string): Promise<OrderSummary[]> {
        let query = this.userOrdersCollection
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit);

        if (startAfter) {
            const startAfterDoc = await this.collection.doc(startAfter).get();
            query = query.startAfter(startAfterDoc);
        }

        const snapshot = await query.get();

        return snapshot.docs.map(doc => ({
            id: doc.data().orderId,
            orderNumber: doc.data().orderNumber,
            status: doc.data().status,
            paymentStatus: doc.data().paymentStatus,
            total: doc.data().total,
            currency: 'KES',
            itemCount: doc.data().itemCount || 0,
            createdAt: doc.data().createdAt.toDate()
        }));
    }

    async findAll(filters: OrderFilters = {}): Promise<Order[]> {
        let query = this.collection
            .orderBy('createdAt', 'desc')
            .limit(100);

        if (filters.userId) {
            query = query.where('userId', '==', filters.userId);
        }
        if (filters.status) {
            query = query.where('status', '==', filters.status);
        }
        if (filters.paymentStatus) {
            query = query.where('paymentStatus', '==', filters.paymentStatus);
        }
        if (filters.dateFrom) {
            query = query.where('createdAt', '>=', filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.where('createdAt', '<=', filters.dateTo);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as Order);
    }

    // ========== UPDATE ==========
    async update(id: string, data: Partial<Order>): Promise<void> {
        const updates = {
            ...data,
            updatedAt: new Date()
        };

        await this.collection.doc(id).update(updates);
    }

    async updateStatus(id: string, status: OrderStatus, reason?: string): Promise<void> {
        const order = await this.findById(id);
        if (!order) throw new Error('Order not found');

        await this.collection.doc(id).update({
            status,
            ...(reason && { [`statusHistory.${status}`]: { timestamp: new Date(), reason } }),
            updatedAt: new Date()
        });

        // Update user order index
        await this.userOrdersCollection
            .doc(`${order.userId}_${id}`)
            .update({ status, updatedAt: new Date() });
    }

    async updatePaymentStatus(
        id: string,
        paymentStatus: PaymentStatus,
        paymentData?: any
    ): Promise<void> {
        await this.collection.doc(id).update({
            paymentStatus,
            ...paymentData,
            updatedAt: new Date()
        });
    }

    async updateShippingStatus(
        id: string,
        shippingStatus: ShippingStatus,
        trackingInfo?: { trackingNumber: string; carrier: string }
    ): Promise<void> {
        await this.collection.doc(id).update({
            shippingStatus,
            ...trackingInfo,
            updatedAt: new Date()
        });
    }

    // ========== DELETE / SOFT DELETE ==========
    async softDelete(id: string): Promise<void> {
        await this.collection.doc(id).update({
            isDeleted: true,
            deletedAt: new Date(),
            status: 'cancelled',
            updatedAt: new Date()
        });
    }

    // ========== ANALYTICS ==========
    async getOrderStats(userId?: string): Promise<any> {
        let query = this.collection
            .where('createdAt', '>=', new Date(new Date().setDate(new Date().getDate() - 30)));

        if (userId) {
            query = query.where('userId', '==', userId);
        }

        const snapshot = await query.get();
        const orders = snapshot.docs.map(doc => doc.data() as Order);

        return {
            totalOrders: orders.length,
            totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
            averageOrderValue: orders.length > 0
                ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length
                : 0,
            statusBreakdown: orders.reduce((acc, order) => {
                acc[order.status] = (acc[order.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            paymentStatusBreakdown: orders.reduce((acc, order) => {
                acc[order.paymentStatus] = (acc[order.paymentStatus] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        };
    }

    // ========== UTILITY ==========
    private generateOrderNumber(): string {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `ORD-${timestamp}${random}`;
    }
}