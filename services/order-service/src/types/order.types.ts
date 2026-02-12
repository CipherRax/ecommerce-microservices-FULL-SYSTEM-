import { z } from 'zod';

// ========== ENUMS ==========
export enum OrderStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled',
    REFUNDED = 'refunded',
    FAILED = 'failed'
}

export enum PaymentStatus {
    PENDING = 'pending',
    PAID = 'paid',
    FAILED = 'failed',
    REFUNDED = 'refunded',
    PARTIALLY_REFUNDED = 'partially_refunded'
}

export enum ShippingStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    IN_TRANSIT = 'in_transit',
    OUT_FOR_DELIVERY = 'out_for_delivery',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    RETURNED = 'returned'
}

// ========== SCHEMAS ==========
export const AddressSchema = z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    country: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    phone: z.string().min(10).max(20),
    email: z.string().email().optional(),
    notes: z.string().max(500).optional()
});

export const OrderItemSchema = z.object({
    productId: z.string().min(1),
    variantId: z.string().optional(),
    sku: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    discount: z.number().min(0).default(0),
    tax: z.number().min(0).default(0),
    total: z.number().positive(),
    image: z.string().url().optional(),
    attributes: z.record(z.string()).optional()
});

export const CreateOrderSchema = z.object({
    userId: z.string().min(1),
    items: z.array(OrderItemSchema).min(1),
    shippingAddress: AddressSchema,
    billingAddress: AddressSchema.optional(),
    paymentMethod: z.enum(['mpesa', 'card', 'bank_transfer', 'cod']),
    shippingMethod: z.string().min(1),
    shippingCost: z.number().min(0).default(0),
    discount: z.number().min(0).default(0),
    tax: z.number().min(0).default(0),
    subtotal: z.number().positive(),
    total: z.number().positive(),
    currency: z.string().default('KES'),
    notes: z.string().max(1000).optional(),
    couponCode: z.string().optional()
});

export const UpdateOrderStatusSchema = z.object({
    status: z.enum([
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED
    ]),
    reason: z.string().optional()
});

// ========== TYPES ==========
export type Address = z.infer<typeof AddressSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;

export interface Order {
    id: string;
    orderNumber: string;
    userId: string;
    items: OrderItem[];
    shippingAddress: Address;
    billingAddress: Address;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    shippingStatus: ShippingStatus;
    paymentMethod: string;
    shippingMethod: string;
    subtotal: number;
    shippingCost: number;
    discount: number;
    tax: number;
    total: number;
    currency: string;
    couponCode?: string;
    notes?: string;
    adminNotes?: string;
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: Date;
    actualDelivery?: Date;
    cancelledAt?: Date;
    cancelledBy?: string;
    cancellationReason?: string;
    refundedAt?: Date;
    refundAmount?: number;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrderSummary {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    total: number;
    currency: string;
    itemCount: number;
    createdAt: Date;
}

export interface OrderFilters {
    userId?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
}