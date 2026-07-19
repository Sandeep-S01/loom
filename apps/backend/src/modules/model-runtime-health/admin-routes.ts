import type { FastifyInstance, FastifyRequest } from "fastify";
import { unauthorized } from "../../lib/http-errors.js";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelRuntimeHealthService } from "./interfaces.js";
import {
  assertRegistryModelId,
  parseModelRuntimeHealthListQuery,
  parseResetModelRuntimeHealthInput,
  parseUpsertModelRuntimeHealthBody,
} from "./validators.js";

interface RegisterModelRuntimeHealthAdminRoutesOptions {
  modelRuntimeHealthService: ModelRuntimeHealthService;
}

export async function registerModelRuntimeHealthAdminRoutes(
  app: FastifyInstance,
  options: RegisterModelRuntimeHealthAdminRoutesOptions,
) {
  app.get("/model-runtime-health", async (request) => {
    requireAdmin(request);
    return options.modelRuntimeHealthService.listRuntimeHealth(
      parseModelRuntimeHealthListQuery(request.query as Record<string, unknown>),
    );
  });

  app.get("/model-runtime-health/:registryModelId", async (request) => {
    requireAdmin(request);
    const params = request.params as { registryModelId?: string };
    return options.modelRuntimeHealthService.getRuntimeHealthModel(
      assertRegistryModelId(params.registryModelId),
    );
  });

  app.put("/model-runtime-health/:registryModelId", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const params = request.params as { registryModelId?: string };
    return options.modelRuntimeHealthService.upsertRuntimeHealth(
      parseUpsertModelRuntimeHealthBody(
        assertRegistryModelId(params.registryModelId),
        request.body,
        sessionUser.id,
      ),
    );
  });

  app.post("/model-runtime-health/:registryModelId/reset", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const params = request.params as { registryModelId?: string };
    return options.modelRuntimeHealthService.resetRuntimeHealth(
      parseResetModelRuntimeHealthInput(
        assertRegistryModelId(params.registryModelId),
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
