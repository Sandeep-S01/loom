import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ProviderManagementService } from "./interfaces.js";
import { unauthorized } from "../../lib/http-errors.js";
import {
  assertProviderId,
  optionalString,
  parseCredentialCheckBody,
  parseProviderListQuery,
  parseUpdateProviderBody,
} from "./validators.js";

interface RegisterProviderAdminRoutesOptions {
  providerManagementService: ProviderManagementService;
}

export async function registerProviderAdminRoutes(
  app: FastifyInstance,
  options: RegisterProviderAdminRoutesOptions,
) {
  app.get("/providers", async (request) => {
    requireAdmin(request);
    return options.providerManagementService.listProviders(
      parseProviderListQuery(request.query as Record<string, unknown>),
    );
  });

  app.patch("/providers/:providerId", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const params = request.params as { providerId?: string };
    const providerId = assertProviderId(params.providerId);
    return options.providerManagementService.updateProvider({
      providerId,
      update: parseUpdateProviderBody(request.body),
      actorUserId: sessionUser.id,
    });
  });

  app.get("/provider-credentials", async (request) => {
    requireAdmin(request);
    const query = request.query as Record<string, unknown>;
    return options.providerManagementService.listCredentials({
      providerId: optionalString(query.providerId)?.trim(),
    });
  });

  app.post("/provider-credentials/check", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    return options.providerManagementService.checkCredential({
      ...parseCredentialCheckBody(request.body),
      actorUserId: sessionUser.id,
    });
  });
}

function getRequiredSessionUser(request: Parameters<typeof requireAdmin>[0]) {
  if (!request.sessionUser) {
    throw unauthorized("Authentication required.");
  }
  return request.sessionUser;
}
