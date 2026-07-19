import type { FastifyInstance, FastifyRequest } from "fastify";
import { unauthorized } from "../../lib/http-errors.js";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelDiscoveryService } from "./interfaces.js";
import {
  assertDiscoveryJobId,
  assertProviderId,
  parseDiscoveryJobListQuery,
  parseProviderSyncStatusListQuery,
  parseRunDiscoveryBody,
} from "./validators.js";

interface RegisterModelDiscoveryAdminRoutesOptions {
  modelDiscoveryService: ModelDiscoveryService;
}

export async function registerModelDiscoveryAdminRoutes(
  app: FastifyInstance,
  options: RegisterModelDiscoveryAdminRoutesOptions,
) {
  app.get("/discovery/jobs", async (request) => {
    requireAdmin(request);
    return options.modelDiscoveryService.listJobs(
      parseDiscoveryJobListQuery(request.query as Record<string, unknown>),
    );
  });

  app.get("/discovery/jobs/:jobId", async (request) => {
    requireAdmin(request);
    const params = request.params as { jobId?: string };
    return options.modelDiscoveryService.getJob(assertDiscoveryJobId(params.jobId));
  });

  app.post("/discovery/jobs", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    return options.modelDiscoveryService.runProviderDiscovery(
      parseRunDiscoveryBody(request.body, sessionUser.id),
    );
  });

  app.get("/provider-sync-status", async (request) => {
    requireAdmin(request);
    return options.modelDiscoveryService.listProviderSyncStatus(
      parseProviderSyncStatusListQuery(request.query as Record<string, unknown>),
    );
  });

  app.get("/provider-sync-status/:providerId", async (request) => {
    requireAdmin(request);
    const params = request.params as { providerId?: string };
    return options.modelDiscoveryService.getProviderSyncStatus(
      assertProviderId(params.providerId),
    );
  });
}

function getRequiredSessionUser(request: FastifyRequest) {
  if (!request.sessionUser) {
    throw unauthorized("Authentication required.");
  }
  return request.sessionUser;
}
