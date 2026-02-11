import Fastify from "fastify";
import { auth } from "./firebase";
import { verifyToken } from "./middleware/auth"; // ← new
import { UserDto } from "@shared/types";

const fastify = Fastify({
  logger: true,
});

fastify.decorateRequest("user", null); // helps TypeScript know the property exists

// ── Public routes (no auth needed)
fastify.get("/health", async () => {
  return { status: "ok", service: "auth" };
});

fastify.get("/firebase-test", async () => {
  try {
    const userList = await auth.listUsers(1);
    return {
      firebaseConnected: true,
      hasUsers: userList.users.length > 0,
    };
  } catch (err) {
    fastify.log.error(err);
    return { firebaseConnected: false, error: (err as Error).message };
  }
});

fastify.get("/public", async () => {
  return { message: "This is open to everyone – no token needed" };
});

// ── Protected routes group
fastify.register(
  async function protectedRoutes(app) {
    app.addHook("preHandler", verifyToken);

    app.get("/me", async (request, reply) => {
      if (!request.user) {
        return reply.code(500).send({ error: "User not attached" });
      }

      const user: UserDto = {
        uid: request.user.uid,
        email: request.user.email || "no-email",
        name: request.user.name || "anonymous",
        auth_time: new Date(request.user.auth_time * 1000).toISOString(),
      };

      return user;
    });

    // ← Add more protected routes here later, e.g.
    // app.post('/something', async (req, reply) => { ... })
  },
  { prefix: "" }, // optional – can be '/api' if you want prefix
);

// ── Start server (keep your existing start function)
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: "0.0.0.0" });
    fastify.log.info(`Auth service listening on http://localhost:3001`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
