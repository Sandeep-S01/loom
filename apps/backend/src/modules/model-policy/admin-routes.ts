import type { FastifyInstance, FastifyRequest } from "fastify";
import { unauthorized } from "../../lib/http-errors.js";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelPolicyService } from "./interfaces.js";
import {
  assertRegistryModelId,
  parseDeleteModelPolicyInput,
  parseModelPolicyListQuery,
  parseUpsertModelPolicyBody,
} from "./validators.js";

interface RegisterModelPolicyAdminRoutesOptions {
  modelPolicyService: ModelPolicyService;
}

export async function registerModelPolicyAdminRoutes(
  app: FastifyInstance,
  options: RegisterModelPolicyAdminRoutesOptions,
) {
  app.get("/model-policy", async (request) => {
    requireAdmin(request);
    return options.modelPolicyService.listPolicies(
      parseModelPolicyListQuery(request.query as Record<string, unknown>),
    );
  });

  app.get("/model-policy/:registryModelId", async (request) => {
    requireAdmin(request);
    const params = request.params as { registryModelId?: string };
    return options.modelPolicyService.getPolicy(
      assertRegistryModelId(params.registryModelId),
    );
  });

  app.put("/model-policy/:registryModelId", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const params = request.params as { registryModelId?: string };
    return options.modelPolicyService.upsertPolicy(
      parseUpsertModelPolicyBody(
        assertRegistryModelId(params.registryModelId),
        request.body,
        sessionUser.id,
      ),
    );
  });

  app.delete("/model-policy/:registryModelId", async (request) => {
    requireAdmin(request);
    const sessionUser = getRequiredSessionUser(request);
    const params = request.params as { registryModelId?: string };
    return options.modelPolicyService.deletePolicy(
      parseDeleteModelPolicyInput(
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
