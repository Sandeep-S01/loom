import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelCatalogService } from "./interfaces.js";
import {
  assertCatalogModelId,
  parseModelCatalogListQuery,
} from "./validators.js";

interface RegisterModelCatalogAdminRoutesOptions {
  modelCatalogService: ModelCatalogService;
}

export async function registerModelCatalogAdminRoutes(
  app: FastifyInstance,
  options: RegisterModelCatalogAdminRoutesOptions,
) {
  app.get("/model-catalog", async (request) => {
    requireAdmin(request);
    return options.modelCatalogService.listCatalog(
      parseModelCatalogListQuery(request.query as Record<string, unknown>),
    );
  });

  app.get("/model-catalog/:catalogModelId", async (request) => {
    requireAdmin(request);
    const params = request.params as { catalogModelId?: string };
    return options.modelCatalogService.getCatalogModel(
      assertCatalogModelId(params.catalogModelId),
    );
  });
}
