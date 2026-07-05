import type { FastifyInstance } from "fastify";
import type { DashboardService } from "./service.js";

interface RegisterDashboardRoutesOptions {
  dashboardService: DashboardService;
}

export async function registerDashboardRoutes(
  app: FastifyInstance,
  options: RegisterDashboardRoutesOptions,
) {
  app.get("/", async (request, reply) => {
    if (!request.sessionUser) {
      reply.status(500);
      return {
        error: {
          code: "INTERNAL_ERROR",
          message: "Session user is not available",
          requestId: request.id,
        },
      };
    }

    return options.dashboardService.getDashboard(request.sessionUser.id);
  });
}
