import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { MarketplaceService } from "./service.js";

interface RegisterMarketplaceRoutesOptions {
  marketplaceService: MarketplaceService;
}

export async function registerMarketplaceRoutes(
  app: FastifyInstance,
  options: RegisterMarketplaceRoutesOptions,
) {
  app.get("/free-models", async () => options.marketplaceService.listFreeModels());

  app.post("/free-models/sync", async (request) => {
    requireAdmin(request);
    return options.marketplaceService.syncOpenRouterFreeModels();
  });

  app.post("/free-models/:modelId/enable", async (request) => {
    requireAdmin(request);

    const params = request.params as { modelId: string };
    const model = await options.marketplaceService.enableFreeModel(params.modelId);
    return { model };
  });

  app.post("/free-models/:modelId/disable", async (request) => {
    requireAdmin(request);

    const params = request.params as { modelId: string };
    const model = await options.marketplaceService.disableFreeModel(params.modelId);
    return { model };
  });
}
