import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelFallbackService } from "./interfaces.js";
import {
  parseFallbackDecisionListQuery,
  parseSelectFallbackBody,
} from "./validators.js";

interface RegisterModelFallbackAdminRoutesOptions {
  modelFallbackService: ModelFallbackService;
}

export async function registerModelFallbackAdminRoutes(
  app: FastifyInstance,
  options: RegisterModelFallbackAdminRoutesOptions,
) {
  app.post("/fallback/select", async (request) => {
    requireAdmin(request);
    return options.modelFallbackService.selectFallback(
      parseSelectFallbackBody(request.body, request.sessionUser!.id),
    );
  });

  app.get("/fallback-decisions", async (request) => {
    requireAdmin(request);
    return options.modelFallbackService.listDecisions(
      parseFallbackDecisionListQuery(request.query as Record<string, unknown>),
    );
  });
}
