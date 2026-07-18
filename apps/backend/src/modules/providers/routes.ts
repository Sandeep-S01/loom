import type { FastifyInstance } from "fastify";
import type { ModelRegistryService } from "../models/service.js";

interface RegisterProviderRoutesOptions {
  modelRegistryService: ModelRegistryService;
}

export async function registerProviderRoutes(
  app: FastifyInstance,
  options: RegisterProviderRoutesOptions,
) {
  app.get("/", async () => options.modelRegistryService.getProvidersStatus());

  app.get("/models", async (request) => {
    const query = request.query as { mode?: string };
    const mode = query.mode === "agent" ? "agent" : "chat";
    const models = await options.modelRegistryService.listSelectorModels(mode);

    return {
      models,
    };
  });
}
