import type { FastifyInstance } from "fastify";
import { badRequest } from "../../lib/http-errors.js";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelRegistryService } from "../models/service.js";

interface RegisterAdminRoutesOptions {
  modelRegistryService: ModelRegistryService;
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  options: RegisterAdminRoutesOptions,
) {
  app.get("/failover-attempts", async (request) => {
    requireAdmin(request);

    if (!options.modelRegistryService.listAttemptEvents) {
      return {
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        hasNextPage: false,
      };
    }

    const query = request.query as {
      page?: string;
      pageSize?: string;
      modelId?: string;
      status?: string;
      from?: string;
      to?: string;
    };

    const status = parseAttemptStatus(query.status);
    const page = parsePositiveInt(query.page, 1);
    const pageSize = Math.min(parsePositiveInt(query.pageSize, 25), 100);

    if (query.from && Number.isNaN(new Date(query.from).getTime())) {
      throw badRequest("Invalid from timestamp.");
    }

    if (query.to && Number.isNaN(new Date(query.to).getTime())) {
      throw badRequest("Invalid to timestamp.");
    }

    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw badRequest("From timestamp must not be after to timestamp.");
    }

    return options.modelRegistryService.listAttemptEvents({
      page,
      pageSize,
      modelId: query.modelId,
      status,
      from: query.from,
      to: query.to,
    });
  });
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseAttemptStatus(value: string | undefined) {
  if (!value) return undefined;
  if (
    value === "success" ||
    value === "failed" ||
    value === "skipped_cooldown" ||
    value === "blocked_quota"
  ) {
    return value;
  }
  throw badRequest("Invalid attempt status filter.");
}
