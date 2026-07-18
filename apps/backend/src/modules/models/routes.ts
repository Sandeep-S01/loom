import type { FastifyInstance } from "fastify";
import type { CreateModelRequest, UpdateModelRequest } from "@clm/shared-types";
import { badRequest } from "../../lib/http-errors.js";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { ModelRegistryService } from "./service.js";

interface RegisterModelRoutesOptions {
  modelRegistryService: ModelRegistryService;
}

export async function registerModelRoutes(
  app: FastifyInstance,
  options: RegisterModelRoutesOptions,
) {
  app.get("/", async (request) => {
    requireAdmin(request);

    const query = request.query as {
      mode?: string;
      includeDisabled?: string;
      includeDeleted?: string;
    };

    return options.modelRegistryService.listModels({
      mode:
        query.mode === "agent"
          ? "agent"
          : query.mode === "chat"
            ? "chat"
            : undefined,
      includeDisabled: query.includeDisabled === "true",
      includeDeleted: query.includeDeleted === "true",
    });
  });

  app.get("/selector", async (request) => {
    const query = request.query as { mode?: string };
    const mode = query.mode === "agent" ? "agent" : "chat";
    const models = await options.modelRegistryService.listSelectorModels(mode);
    return { models };
  });

  app.get("/analytics", async (request) => {
    requireAdmin(request);

    const query = request.query as {
      from?: string;
      to?: string;
      granularity?: string;
      modelId?: string;
    };

    if (!query.from || !query.to) {
      throw badRequest("Analytics range requires from and to timestamps.");
    }

    const from = parseTimestamp(query.from, "from");
    const to = parseTimestamp(query.to, "to");
    if (from > to) {
      throw badRequest("Analytics from timestamp must not be after to timestamp.");
    }

    const granularity = query.granularity === "day" ? "day" : "hour";
    const analytics = await options.modelRegistryService.getAnalytics?.({
      from: from.toISOString(),
      to: to.toISOString(),
      granularity,
      modelId: query.modelId,
    });

    return analytics ?? { summary: [], series: [] };
  });

  app.post("/", async (request, reply) => {
    requireAdmin(request);

    const body = parseCreateModelRequest(request.body);

    const model = await options.modelRegistryService.createModel({
      providerId: body.providerId,
      providerModelId: body.providerModelId,
      displayName: body.displayName,
      secretRef: body.secretRef ?? null,
      priorityRank: body.priorityRank,
      supportsChat: body.supportsChat,
      supportsAgent: body.supportsAgent,
      supportsVision: body.supportsVision ?? false,
      adminStatus: body.adminStatus,
      requestsPerMinuteLimit: body.requestsPerMinuteLimit ?? null,
      tokensPerDayLimit: body.tokensPerDayLimit ?? null,
      costInputPer1mUsdMicros: body.costInputPer1mUsdMicros ?? null,
      costOutputPer1mUsdMicros: body.costOutputPer1mUsdMicros ?? null,
    });

    reply.status(201);
    return { model };
  });

  app.patch("/:modelId", async (request) => {
    requireAdmin(request);

    const params = request.params as { modelId: string };
    const body = parseUpdateModelRequest(request.body);
    const model = await options.modelRegistryService.updateModel(
      params.modelId,
      body,
    );
    return { model };
  });

  app.delete("/:modelId", async (request) => {
    requireAdmin(request);

    const params = request.params as { modelId: string };
    const model = await options.modelRegistryService.deleteModel(params.modelId);
    return { model };
  });
}

const MODEL_FIELDS = new Set([
  "providerId",
  "providerModelId",
  "displayName",
  "secretRef",
  "priorityRank",
  "supportsChat",
  "supportsAgent",
  "supportsVision",
  "adminStatus",
  "requestsPerMinuteLimit",
  "tokensPerDayLimit",
  "costInputPer1mUsdMicros",
  "costOutputPer1mUsdMicros",
]);

function parseCreateModelRequest(value: unknown): CreateModelRequest {
  const body = parseModelObject(value);
  return {
    providerId: requiredString(body, "providerId", 50),
    providerModelId: requiredString(body, "providerModelId", 255),
    displayName: requiredString(body, "displayName", 255),
    secretRef: optionalSecretRef(body.secretRef),
    priorityRank: requiredInteger(body, "priorityRank", 0),
    supportsChat: requiredBoolean(body, "supportsChat"),
    supportsAgent: requiredBoolean(body, "supportsAgent"),
    supportsVision: optionalBoolean(body, "supportsVision"),
    adminStatus: requiredAdminStatus(body.adminStatus),
    requestsPerMinuteLimit: optionalPositiveInteger(body.requestsPerMinuteLimit, "requestsPerMinuteLimit"),
    tokensPerDayLimit: optionalPositiveInteger(body.tokensPerDayLimit, "tokensPerDayLimit"),
    costInputPer1mUsdMicros: optionalNonNegativeInteger(body.costInputPer1mUsdMicros, "costInputPer1mUsdMicros"),
    costOutputPer1mUsdMicros: optionalNonNegativeInteger(body.costOutputPer1mUsdMicros, "costOutputPer1mUsdMicros"),
  };
}

function parseUpdateModelRequest(value: unknown): UpdateModelRequest {
  const body = parseModelObject(value);
  if (Object.keys(body).length === 0) {
    throw badRequest("Model update payload must include at least one field.");
  }

  const result: UpdateModelRequest = {};
  if ("providerId" in body) result.providerId = requiredString(body, "providerId", 50);
  if ("providerModelId" in body) result.providerModelId = requiredString(body, "providerModelId", 255);
  if ("displayName" in body) result.displayName = requiredString(body, "displayName", 255);
  if ("secretRef" in body) result.secretRef = optionalSecretRef(body.secretRef);
  if ("priorityRank" in body) result.priorityRank = requiredInteger(body, "priorityRank", 0);
  if ("supportsChat" in body) result.supportsChat = requiredBoolean(body, "supportsChat");
  if ("supportsAgent" in body) result.supportsAgent = requiredBoolean(body, "supportsAgent");
  if ("supportsVision" in body) result.supportsVision = requiredBoolean(body, "supportsVision");
  if ("adminStatus" in body) result.adminStatus = requiredAdminStatus(body.adminStatus);
  if ("requestsPerMinuteLimit" in body) result.requestsPerMinuteLimit = optionalPositiveInteger(body.requestsPerMinuteLimit, "requestsPerMinuteLimit");
  if ("tokensPerDayLimit" in body) result.tokensPerDayLimit = optionalPositiveInteger(body.tokensPerDayLimit, "tokensPerDayLimit");
  if ("costInputPer1mUsdMicros" in body) result.costInputPer1mUsdMicros = optionalNonNegativeInteger(body.costInputPer1mUsdMicros, "costInputPer1mUsdMicros");
  if ("costOutputPer1mUsdMicros" in body) result.costOutputPer1mUsdMicros = optionalNonNegativeInteger(body.costOutputPer1mUsdMicros, "costOutputPer1mUsdMicros");
  return result;
}

function parseModelObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Model payload must be an object.");
  }
  const body = value as Record<string, unknown>;
  const unknownField = Object.keys(body).find((key) => !MODEL_FIELDS.has(key));
  if (unknownField) throw badRequest(`Unknown model field: ${unknownField}.`);
  return body;
}

function requiredString(body: Record<string, unknown>, field: string, maxLength: number) {
  const value = body[field];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw badRequest(`${field} must be a non-empty string up to ${maxLength} characters.`);
  }
  return value.trim();
}

function requiredInteger(body: Record<string, unknown>, field: string, minimum: number) {
  const value = body[field];
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw badRequest(`${field} must be an integer greater than or equal to ${minimum}.`);
  }
  return value as number;
}

function requiredBoolean(body: Record<string, unknown>, field: string) {
  if (typeof body[field] !== "boolean") throw badRequest(`${field} must be a boolean.`);
  return body[field] as boolean;
}

function optionalBoolean(body: Record<string, unknown>, field: string) {
  return field in body ? requiredBoolean(body, field) : undefined;
}

function optionalSecretRef(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^[A-Z_][A-Z0-9_]*$/.test(value) || value.length > 255) {
    throw badRequest("secretRef must be a valid environment variable name.");
  }
  return value;
}

function requiredAdminStatus(value: unknown) {
  if (value === "active" || value === "disabled") return value;
  throw badRequest("adminStatus must be active or disabled.");
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw badRequest(`${field} must be a positive integer or null.`);
  }
  return value as number;
}

function optionalNonNegativeInteger(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw badRequest(`${field} must be a non-negative integer or null.`);
  }
  return value as number;
}

function parseTimestamp(value: string, field: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw badRequest(`Invalid ${field} timestamp.`);
  return parsed;
}
