import type { FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "../lib/http-errors.js";

export function requireAdmin(request: FastifyRequest) {
  if (!request.sessionUser) {
    throw unauthorized("Authentication required.");
  }

  if (request.sessionUser.role !== "admin") {
    throw forbidden("Admin access required.");
  }
}
