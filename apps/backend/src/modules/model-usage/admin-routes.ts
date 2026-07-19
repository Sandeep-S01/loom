import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelUsageService } from "./interfaces.js";
import {
  parseRecordModelUsageBody,
  parseUsageCounterListQuery,
  parseUsageSummaryQuery,
} from "./validators.js";

interface RegisterModelUsageAdminRoutesOptions {
  modelUsageService: ModelUsageService;
}

export async function registerModelUsageAdminRoutes(
  app: FastifyInstance,
  options: RegisterModelUsageAdminRoutesOptions,
) {
  app.post("/model-usage", async (request) => {
    requireAdmin(request);
    return options.modelUsageService.recordUsage(
      parseRecordModelUsageBody(request.body),
    );
  });

  app.get("/model-usage/counters", async (request) => {
    requireAdmin(request);
    return options.modelUsageService.listCounters(
      parseUsageCounterListQuery(request.query as Record<string, unknown>),
    );
  });

  app.get("/model-usage/summary", async (request) => {
    requireAdmin(request);
    return options.modelUsageService.getSummary(
      parseUsageSummaryQuery(request.query as Record<string, unknown>),
    );
  });
}
