import Fastify from "fastify";
import { firestore } from "./firebase.js";
// import { Product } from "@shared/types";
// @ts-ignore
import type { Product } from "@shared/types";
import {verifyToken} from "./middleware/auth"; // note .js

const fastify = Fastify({
  logger: true,
});

// Public health check
fastify.get('/health', async () => {
  return { status: 'ok', service: 'product' };
});

// List active products (public for now)
fastify.get('/products', async () => {
  try {
    console.log('[/products] Starting Firestore query...');

    const snapshot = await firestore.collection('products').get();

    console.log('[/products] Query succeeded. Document count:', snapshot.size);

    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      count: products.length,
      data: products
    };
  } catch (err: any) {
    console.error('[/products] Firestore error:', {
      message: err.message,
      code: err.code,
      details: err.details,
      stack: err.stack?.substring(0, 300) // first part of stack
    });

    return {
      success: false,
      error: {
        message: 'Failed to fetch products',
        details: err.message || 'Unknown error'
      }
    };
  }
});

// Get single product (public)
fastify.get('/products/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  try {
    const docRef = firestore.collection('products').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      reply.code(404);
      return { success: false, error: { message: 'Product not found' } };
    }

    const product = { id: doc.id, ...doc.data() } as Product;
    return { success: true, data: product };
  } catch (err) {
    fastify.log.error(err);
    reply.code(500);
    return { success: false, error: { message: 'Server error' } };
  }
});

// in product-service/src/index.ts
fastify.get('/debug-simple', async () => {
  try {
    const snap = await firestore.collection('products').get(); // no where/order
    return {
      success: true,
      count: snap.size,
      docs: snap.docs.map(d => ({ id: d.id, ...d.data() }))
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

fastify.get('/test-db', async () => {
  try {
    console.log('Test: Getting firestore ref...');
    const colRef = firestore.collection('products');
    console.log('Test: Collection ref created');

    const snap = await colRef.limit(1).get();
    console.log('Test: Query done, size:', snap.size);

    return { success: true, size: snap.size };
  } catch (err: any) {
    console.error('Test error:', err.code, err.message, err.details);
    return { success: false, error: err.message };
  }
});


// Protected group – all routes here require token
fastify.register(async function protectedRoutes(app) {
  app.addHook('preHandler', verifyToken);

  app.post('/products', async (request, reply) => {
    const body = request.body as {
      name: string;
      description?: string;
      price: number;
      stock: number;
      images?: string[];
      currency?: string;
    };

    // Simple validation (we'll add zod later if needed)
    if (!body.name || !body.price || body.price <= 0 || !body.stock || body.stock < 0) {
      reply.code(400);
      return { success: false, error: { message: 'Missing or invalid required fields' } };
    }

    try {
      const user = request.user!;
      const productData = {
        name: body.name.trim(),
        description: body.description?.trim(),
        price: body.price,
        stock: body.stock,
        images: body.images || [],
        currency: body.currency || 'KES',
        sellerId: user.uid,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await firestore.collection('products').add(productData);

      return {
        success: true,
        data: { id: docRef.id, ...productData },
        message: 'Product created successfully',
      };
    } catch (err: any) {
      console.error('Create product error:', err);
      reply.code(500);
      return { success: false, error: { message: 'Failed to create product' } };
    }
  });
});

// ── Server start (must be at the end)
const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' });
    fastify.log.info('Product service listening on http://localhost:3002');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();