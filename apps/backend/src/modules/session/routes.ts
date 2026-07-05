import type { FastifyInstance } from "fastify";

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    return {
      user: request.sessionUser,
    };
  });
}
