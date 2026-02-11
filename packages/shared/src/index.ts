// ── Common types used across services ────────────────────────────────

// User (from Firebase, but simplified + extended)
export interface UserDto {
  uid: string;
  email?: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
  createdAt?: string; // ISO string
  lastSignIn?: string;
  role?: "user" | "admin" | "seller"; // we can extend later
}

// Standard API error shape (used in all 4xx/5xx responses)
export interface ApiError {
  error: string;
  message?: string;
  code?: string; // e.g. 'auth/id-token-expired'
  status?: number;
}

// Common success response wrapper (optional, but consistent)
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Product (very minimal for now)
export interface Product {
  id: string; // Firestore doc ID
  name: string;
  description?: string;
  price: number; // in KES or smallest unit
  currency?: "KES" | "USD";
  stock: number;
  images?: string[]; // URLs
  sellerId: string; // user uid
  createdAt: string;
  updatedAt?: string;
  isActive: boolean;
}

// Order (minimal skeleton)
export interface Order {
  id: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    priceAtPurchase: number;
  }>;
  totalAmount: number;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  paymentMethod?: "mpesa" | "stripe" | "cash";
  paymentReference?: string;
}
