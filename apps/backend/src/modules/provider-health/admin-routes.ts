import type { FastifyInstance, FastifyRequest } from "fastify";
import { unauthorized } from "../../lib/http-errors.js";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ProviderHealthService } from "./interfaces.js";
import {
  assertProviderId,
  parseProviderHealthListQuery,
  parseResetProviderHealthInput,
  parseUpsertProviderHealthBody,
} from "./validators.js";

interface RegisterProviderHealthAdminRoutesOptions {
  providerHealthService: ProviderHealthService;
}

export async function registerProviderHealthAdminRoutes(
  app: FastifyInstance,
  options: RegisterProviderHealthAdminRoutesOptions,
) {
  app.get("/provider-health", async (request) => {
    requireAdmin(request);
    return options.providerHealthService.listProviderHealth(
      parseProviderHealthListQuery(request.query as Record<string, unknown>),
    );
  });

  app.get("/provider-health/:providerId", async (request) => {
    requireAdmin(request);
    const params = request.params as { providerId?: string };
    return options.providerHealthService.getProviderHealthModel(
      assertProviderId(params.providerId),
    );
  });

  app.put("/provider-health/:providerId", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const params = request.params as { providerId?: string };
    return options.providerHealthService.upsertProviderHealth(
      parseUpsertProviderHealthBody(
        assertProviderId(params.providerId),
        request.body,
        sessionUser.id,
      ),
    );
  });

  app.post("/provider-health/:providerId/reset", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const params = request.params as { providerId?: string };
    return options.providerHealthService.resetProviderHealth(
      parseResetProviderHealthInput(assertProviderId(params.providerId), sessionUser.id),
    );
  });
}

function getRequiredSessionUser(request: FastifyRequest) {
  if (!request.sessionUser) {
    throw unauthorized("Authentication required.");
  }
  return request.sessionUser;
}
