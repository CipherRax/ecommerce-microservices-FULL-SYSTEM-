import { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify";
import { auth as firebaseAuth } from "../firebase";
import { admin } from "../firebase";
import { ApiError } from "@shared/types";

// Extend FastifyRequest to add user (TypeScript friendly)
declare module "fastify" {
  interface FastifyRequest {
    user?: admin.auth.DecodedIdToken; // from firebase-admin
  }
}

export const verifyToken = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  // ← explicit return type helps clarity
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401);
    reply.send({ error: "No token provided" } as ApiError);
    return; // early return after sending reply
  }

  const idToken = authHeader.split("Bearer ")[1].trim();

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    request.user = decodedToken;
    // No return needed — just continue to next handler
  } catch (error: any) {
    console.error("Token verification failed:", error);

    const message =
      error.code === "auth/id-token-expired"
        ? "Token expired"
        : error.code === "auth/id-token-revoked"
          ? "Token revoked"
          : "Invalid token";

    reply.code(401);
    reply.send({ error: message, code: error.code } as ApiError);
  }
};
