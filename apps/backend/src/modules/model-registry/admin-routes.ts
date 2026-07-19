import type { FastifyInstance, FastifyRequest } from "fastify";
import { unauthorized } from "../../lib/http-errors.js";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelRegistryApprovalService } from "./interfaces.js";
import {
  assertRegistryModelId,
  parseArchiveRegistryModelBody,
  parseModelRegistryListQuery,
  parseRegisterCatalogModelBody,
} from "./validators.js";

interface RegisterModelRegistryAdminRoutesOptions {
  modelRegistryApprovalService: ModelRegistryApprovalService;
}

export async function registerModelRegistryAdminRoutes(
  app: FastifyInstance,
  options: RegisterModelRegistryAdminRoutesOptions,
) {
  app.get("/model-registry", async (request) => {
    requireAdmin(request);
    return options.modelRegistryApprovalService.listRegistry(
      parseModelRegistryListQuery(request.query as Record<string, unknown>),
    );
  });

  app.post("/model-registry", async (request, reply) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const result = await options.modelRegistryApprovalService.registerCatalogModel(
      parseRegisterCatalogModelBody(request.body, sessionUser.id),
    );
    reply.status(201);
    return result;
  });

  app.get("/model-registry/:registryModelId", async (request) => {
    requireAdmin(request);
    const params = request.params as { registryModelId?: string };
    return options.modelRegistryApprovalService.getRegistryModel(
      assertRegistryModelId(params.registryModelId),
    );
  });

  app.delete("/model-registry/:registryModelId", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const params = request.params as { registryModelId?: string };
    return options.modelRegistryApprovalService.archiveRegistryModel(
      parseArchiveRegistryModelBody(
        assertRegistryModelId(params.registryModelId),
        request.body,
        sessionUser.id,
      ),
    );
  });
}

function getRequiredSessionUser(request: FastifyRequest) {
  if (!request.sessionUser) {
    throw unauthorized("Authentication required.");
  }
  return request.sessionUser;
}
