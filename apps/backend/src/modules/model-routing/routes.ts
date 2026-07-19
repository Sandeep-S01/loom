import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelRoutingService } from "./interfaces.js";
import {
  parseRoutingAttemptListQuery,
  parseSelectModelRouteBody,
} from "./validators.js";

interface RegisterModelRoutingRoutesOptions {
  modelRoutingService: ModelRoutingService;
}

export async function registerModelRoutingAdminRoutes(
  app: FastifyInstance,
  options: RegisterModelRoutingRoutesOptions,
) {
  app.post("/routing/select", async (request) => {
    requireAdmin(request);
    return options.modelRoutingService.selectRoute(
      parseSelectModelRouteBody(request.body, request.sessionUser!.id),
    );
  });

  app.get("/routing-attempts", async (request) => {
    requireAdmin(request);
    return options.modelRoutingService.listAttempts(
      parseRoutingAttemptListQuery(request.query as Record<string, unknown>),
    );
  });
}
