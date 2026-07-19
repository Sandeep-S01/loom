import type { FastifyInstance } from "fastify";
import { unauthorized } from "../../lib/http-errors.js";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelEligibilityService } from "./interfaces.js";
import { parseEligibilityQuery } from "./validators.js";

interface RegisterModelEligibilityRoutesOptions {
  modelEligibilityService: ModelEligibilityService;
}

export async function registerModelEligibilityRoutes(
  app: FastifyInstance,
  options: RegisterModelEligibilityRoutesOptions,
) {
  app.get("/", async (request) => {
    if (!request.sessionUser) {
      throw unauthorized("Authentication required.");
    }
    const context = parseEligibilityQuery(request.query as Record<string, unknown>);
    if (context.includeIneligible || context.purpose === "admin_diagnostics") {
      requireAdmin(request);
    }
    return options.modelEligibilityService.evaluate(context);
  });
}
