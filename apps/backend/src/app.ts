import Fastify, { type FastifyBaseLogger, type FastifyServerOptions } from "fastify";
import { timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import type { FreeMarketplaceModelItem } from "@clm/shared-types";
import "./plugins/request-context.js";
import { HttpError } from "./lib/http-errors.js";
import {
  createDatabaseConversationRepository,
  createInMemoryConversationRepository,
  type ConversationRepository,
} from "./modules/conversations/repository.js";
import { registerConversationRoutes } from "./modules/conversations/routes.js";
import { registerChatRoutes } from "./modules/chat/routes.js";
import {
  createChatService,
  type ChatService,
  type ProviderInvoker,
} from "./modules/chat/service.js";
import {
  createDatabaseChatIdempotencyStore,
  createInMemoryChatIdempotencyStore,
  createInMemoryConcurrencyLimiter,
  createInMemoryFixedWindowRateLimiter,
} from "./modules/chat/load-control.js";
import {
  createDatabaseSessionService,
  createInMemorySessionService,
  type SessionService,
} from "./modules/session/service.js";
import { registerSessionRoutes } from "./modules/session/routes.js";
import { registerSessionContext } from "./plugins/session.js";
import { recordProviderAttempt } from "./modules/providers/repository.js";
import { globalCooldownTracker } from "./modules/providers/cooldown-tracker.js";
import { geminiDriver } from "./modules/providers/gemini-client.js";
import { openRouterDriver } from "./modules/providers/openrouter-client.js";
import { registerProviderRoutes } from "./modules/providers/routes.js";
import {
  createDatabaseDashboardRepository,
  createInMemoryDashboardRepository,
} from "./modules/dashboard/repository.js";
import {
  createDashboardService,
  getCompanionState,
  type DashboardService,
} from "./modules/dashboard/service.js";
import { registerDashboardRoutes } from "./modules/dashboard/routes.js";
import {
  type CompanionDeviceRecord,
  createDatabaseCompanionRepository,
  createInMemoryCompanionRepository,
} from "./modules/companion/repository.js";
import {
  createCompanionService,
  type CompanionService,
} from "./modules/companion/service.js";
import { registerCompanionRoutes } from "./modules/companion/routes.js";
import {
  createDatabaseWorkspacesRepository,
  type WorkspaceRecord,
  createInMemoryWorkspacesRepository,
} from "./modules/workspaces/repository.js";
import {
  createWorkspacesService,
  type WorkspacesService,
} from "./modules/workspaces/service.js";
import { registerWorkspacesRoutes } from "./modules/workspaces/routes.js";
import { redisKeys } from "./redis/keys.js";
import {
  createDatabaseModelRegistryService,
  createInMemoryModelRegistryService,
  type ModelRegistryModelSeed,
  type ModelRegistryProviderSeed,
  type ModelRegistryService,
} from "./modules/models/service.js";
import {
  createDatabaseModelAnalyticsService,
  createInMemoryModelAnalyticsService,
} from "./modules/models/analytics.js";
import { registerModelRoutes } from "./modules/models/routes.js";
import { createProviderDriverRegistry } from "./modules/providers/driver-registry.js";
import { registerMarketplaceRoutes } from "./modules/marketplace/routes.js";
import {
  createMarketplaceService,
  type MarketplaceService,
} from "./modules/marketplace/service.js";
import { registerMarketplaceSyncJob } from "./modules/marketplace/sync-job.js";
import { registerAdminRoutes } from "./modules/admin/routes.js";
import { registerProviderAdminRoutes } from "./modules/providers/admin-routes.js";
import { registerModelCatalogAdminRoutes } from "./modules/model-catalog/admin-routes.js";
import { registerModelRegistryAdminRoutes } from "./modules/model-registry/admin-routes.js";
import { registerModelPolicyAdminRoutes } from "./modules/model-policy/admin-routes.js";
import { registerModelEligibilityRoutes } from "./modules/model-eligibility/routes.js";
import { registerModelRuntimeHealthAdminRoutes } from "./modules/model-runtime-health/admin-routes.js";
import { registerProviderHealthAdminRoutes } from "./modules/provider-health/admin-routes.js";
import {
  createProviderManagementService,
} from "./modules/providers/management-service.js";
import {
  createDatabaseProviderCredentialRepository,
  createDatabaseProviderRepository,
  createInMemoryProviderCredentialRepository,
  createInMemoryProviderRepository,
} from "./modules/providers/management-repository.js";
import { createEnvSecretReader } from "./modules/providers/secret-reader.js";
import type { ProviderManagementService } from "./modules/providers/interfaces.js";
import { createModelCatalogService } from "./modules/model-catalog/service.js";
import {
  createDatabaseModelCatalogProviderRepository,
  createDatabaseModelCatalogRepository,
  createInMemoryModelCatalogProviderRepository,
  createInMemoryModelCatalogRepository,
} from "./modules/model-catalog/repository.js";
import type { ModelCatalogService } from "./modules/model-catalog/interfaces.js";
import { createModelRegistryApprovalService } from "./modules/model-registry/service.js";
import {
  createDatabaseModelRegistryCatalogReader,
  createDatabaseModelRegistryRepository,
  createInMemoryModelRegistryCatalogReader,
  createInMemoryModelRegistryRepository,
} from "./modules/model-registry/repository.js";
import type { ModelRegistryApprovalService } from "./modules/model-registry/interfaces.js";
import { createModelPolicyService } from "./modules/model-policy/service.js";
import {
  createDatabaseModelPolicyRegistryReader,
  createDatabaseModelPolicyRepository,
  createInMemoryModelPolicyRegistryReader,
  createInMemoryModelPolicyRepository,
} from "./modules/model-policy/repository.js";
import type { ModelPolicyService } from "./modules/model-policy/interfaces.js";
import { createModelEligibilityService } from "./modules/model-eligibility/service.js";
import {
  createDatabaseEligibilitySourceReader,
  createInMemoryEligibilitySourceReader,
} from "./modules/model-eligibility/repository.js";
import type { ModelEligibilityService } from "./modules/model-eligibility/interfaces.js";
import { createModelRuntimeHealthService } from "./modules/model-runtime-health/service.js";
import {
  createDatabaseModelRuntimeHealthRegistryReader,
  createDatabaseModelRuntimeHealthRepository,
  createInMemoryModelRuntimeHealthRegistryReader,
  createInMemoryModelRuntimeHealthRepository,
} from "./modules/model-runtime-health/repository.js";
import type { ModelRuntimeHealthService } from "./modules/model-runtime-health/interfaces.js";
import { createProviderHealthService } from "./modules/provider-health/service.js";
import {
  createDatabaseProviderHealthProviderReader,
  createDatabaseProviderHealthRepository,
  createInMemoryProviderHealthProviderReader,
  createInMemoryProviderHealthRepository,
} from "./modules/provider-health/repository.js";
import type { ProviderHealthService } from "./modules/provider-health/interfaces.js";
import { checkDatabaseConnection } from "./db/connection.js";
import { checkRedisConnection } from "./redis/client.js";
import {
  createOperationalMetrics,
  type OperationalMetrics,
} from "./observability/metrics.js";
import {
  createRetentionCleanupService,
  type RetentionCleanupService,
} from "./maintenance/retention.js";
import { registerRetentionCleanupJob } from "./maintenance/retention-job.js";

interface BuildAppOptions {
  sessionService?: SessionService;
  conversationRepository?: ConversationRepository;
  chatService?: ChatService;
  modelRegistryService?: ModelRegistryService;
  providerManagementService?: ProviderManagementService;
  modelCatalogService?: ModelCatalogService;
  modelRegistryApprovalService?: ModelRegistryApprovalService;
  modelPolicyService?: ModelPolicyService;
  modelEligibilityService?: ModelEligibilityService;
  modelRuntimeHealthService?: ModelRuntimeHealthService;
  providerHealthService?: ProviderHealthService;
  dashboardService?: DashboardService;
  companionService?: CompanionService;
  workspacesService?: WorkspacesService;
  marketplaceService?: MarketplaceService;
  logger?: FastifyServerOptions["logger"];
  readinessProbe?: () => Promise<{
    database: "ok" | "unavailable";
    redis: "ok" | "unavailable";
  }>;
  operationalMetrics?: OperationalMetrics;
  retentionCleanup?: RetentionCleanupService;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? getLoggerOptions(),
    bodyLimit: getEnvInt("API_BODY_LIMIT_BYTES", 25 * 1024 * 1024),
  });
  const startedAt = Date.now();
  const operationalMetrics =
    options.operationalMetrics ??
    createOperationalMetrics({
      collectProcessMetrics:
        process.env.NODE_ENV !== "test" && process.env.VITEST !== "true",
    });

  const allowedCorsOrigins = getAllowedCorsOrigins();
  const inMemoryCompanionDevices: CompanionDeviceRecord[] = [];
  const inMemoryCompanionConnections = new Map<string, string | null>();
  const inMemoryWorkspaces: WorkspaceRecord[] = [];
  const sessionService =
    options.sessionService ?? createInMemorySessionService();
  const conversationRepository =
    options.conversationRepository ?? createInMemoryConversationRepository();
  const modelRegistryService =
    options.modelRegistryService ?? createInMemoryModelRegistryService();
  const providerManagementService =
    options.providerManagementService ??
    createProviderManagementService({
      providerRepository: createInMemoryProviderRepository(),
      credentialRepository: createInMemoryProviderCredentialRepository(),
      secretReader: createEnvSecretReader(),
      logger: app.log,
    });
  const modelCatalogService =
    options.modelCatalogService ??
    createModelCatalogService({
      repository: createInMemoryModelCatalogRepository(),
      providerRepository: createInMemoryModelCatalogProviderRepository(),
      logger: app.log,
    });
  const modelRegistryApprovalService =
    options.modelRegistryApprovalService ??
    createModelRegistryApprovalService({
      repository: createInMemoryModelRegistryRepository(),
      catalogReader: createInMemoryModelRegistryCatalogReader(),
      logger: app.log,
    });
  const modelPolicyService =
    options.modelPolicyService ??
    createModelPolicyService({
      repository: createInMemoryModelPolicyRepository(),
      registryReader: createInMemoryModelPolicyRegistryReader(),
      logger: app.log,
    });
  const modelRuntimeHealthService =
    options.modelRuntimeHealthService ??
    createModelRuntimeHealthService({
      repository: createInMemoryModelRuntimeHealthRepository(),
      registryReader: createInMemoryModelRuntimeHealthRegistryReader(),
      logger: app.log,
    });
  const providerHealthService =
    options.providerHealthService ??
    createProviderHealthService({
      repository: createInMemoryProviderHealthRepository(),
      providerReader: createInMemoryProviderHealthProviderReader(),
      logger: app.log,
    });
  const modelEligibilityService =
    options.modelEligibilityService ??
    createModelEligibilityService({
      sourceReader: createInMemoryEligibilitySourceReader(),
      runtimeHealthReader: modelRuntimeHealthService,
      providerHealthReader: providerHealthService,
      logger: app.log,
    });
  const chatService =
    options.chatService ??
    createChatService({
      conversationRepository,
      getProviderCandidates: async () => {
        const candidates = await modelRegistryService.listRoutingCandidates("chat");
        return candidates.map((candidate) => ({
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          modelId: candidate.modelId,
          modelName: candidate.modelName,
          externalModelKey: candidate.externalModelKey,
          baseType: candidate.driverKey,
          providerPriority: candidate.providerPriority,
          modelPriority: candidate.modelPriority,
          supportsChat: candidate.supportsChat,
          supportsAgent: candidate.supportsAgent,
          supportsVision: candidate.supportsVision,
          secretRef: candidate.secretRef,
          requestsPerMinuteLimit: candidate.requestsPerMinuteLimit,
          contextWindow: candidate.contextWindow,
        }));
      },
      invokeProvider: async () => ({
        ok: false,
        failureCode: "quota_exhausted",
      }),
      onProviderSuccess: async ({ modelId, usage }) => {
        await modelRegistryService.markAttemptSuccess(modelId, usage);
      },
      onProviderFailure: async ({ modelId, failureCode, retryAfterSeconds }) => {
        await modelRegistryService.markAttemptFailure({
          modelId,
          failureCode,
          retryAfterSeconds,
        });
      },
      idempotencyStore: createInMemoryChatIdempotencyStore(),
      concurrencyLimiter: createInMemoryConcurrencyLimiter({
        maxGlobal: getEnvInt("AI_MAX_CONCURRENT_REQUESTS", 10),
        maxPerConversation: getEnvInt("AI_MAX_CONCURRENT_REQUESTS_PER_CONVERSATION", 2),
      }),
      chatRateLimiter: createInMemoryFixedWindowRateLimiter(),
      chatRequestsPerMinuteLimit: getEnvInt("AI_CHAT_REQUESTS_PER_MINUTE", 30),
      modelRateLimiter: createInMemoryFixedWindowRateLimiter(),
      maxProviderHistoryMessages: getEnvInt("AI_MAX_HISTORY_MESSAGES", 40),
      maxTextChars: getEnvInt("AI_MAX_USER_MESSAGE_CHARS", 20_000),
      requestDeadlineMs: getEnvInt("AI_CHAT_REQUEST_DEADLINE_MS", 90_000),
    });
  const dashboardService =
    options.dashboardService ??
    createDashboardService({
      repository: createInMemoryDashboardRepository({
        sharedWorkspaces: inMemoryWorkspaces,
      }),
      getCompanionState: async () =>
        getCompanionState({
          listConnectionEntries: async () =>
            Array.from(inMemoryCompanionConnections.entries()).map(([deviceId, value]) => ({
              key: redisKeys.companionConnection(deviceId),
              value,
            })),
        }),
      getProviderSummary: async () => ({
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      }),
    });
  const companionService =
    options.companionService ??
    createCompanionService({
      repository: createInMemoryCompanionRepository({
        sharedDevices: inMemoryCompanionDevices,
        sharedConnectionStates: inMemoryCompanionConnections,
      }),
    });
  const workspacesService =
    options.workspacesService ??
    createWorkspacesService({
      repository: createInMemoryWorkspacesRepository({
        sharedDevices: inMemoryCompanionDevices,
        sharedWorkspaces: inMemoryWorkspaces,
      }),
    });
  const marketplaceService =
    options.marketplaceService ?? createMarketplaceService();

  registerMarketplaceSyncJob(app, marketplaceService, {
    intervalMs: getOptionalEnvInt("FREE_MARKETPLACE_SYNC_INTERVAL_MS", 0),
    runOnStartup: process.env.FREE_MARKETPLACE_SYNC_ON_STARTUP === "true",
  });

  if (options.retentionCleanup) {
    registerRetentionCleanupJob(app, options.retentionCleanup, {
      intervalMs: getOptionalEnvInt("RETENTION_CLEANUP_INTERVAL_MS", 0),
      runOnStartup: process.env.RETENTION_CLEANUP_ON_STARTUP === "true",
    });
  }

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`), false);
    },
    credentials: true,
  });

  app.register(cookie);

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header("Cache-Control", "no-store");
    if (process.env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    request.log.debug({ requestId: request.id }, "Security response headers applied");
    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    operationalMetrics.observeHttp({
      method: request.method,
      route: request.routeOptions.url ?? "unmatched",
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime,
    });
  });

  app.get("/metrics", async (request, reply) => {
    if (process.env.METRICS_ENABLED !== "true") {
      return reply.status(404).send({ error: "Not found" });
    }
    if (!isMetricsRequestAuthorized(request.headers.authorization)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    reply.header("Content-Type", operationalMetrics.contentType);
    return operationalMetrics.render();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      });

      return;
    }

    request.log.error({ err: error, requestId: request.id }, "Unhandled request error");
    reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected backend failure",
        requestId: request.id,
      },
    });
  });

  const readinessProbe = options.readinessProbe ?? (async () => ({
    database: "ok" as const,
    redis: "ok" as const,
  }));

  app.get("/api/v1/health/live", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }));

  const readinessHandler = async (_request: unknown, reply: { status(code: number): unknown }) => {
    const dependencies = await readinessProbe().catch(() => ({
      database: "unavailable" as const,
      redis: "unavailable" as const,
    }));
    const selectorModels = await modelRegistryService
      .listSelectorModels("chat")
      .catch(() => null);
    const ready =
      dependencies.database === "ok" &&
      dependencies.redis === "ok" &&
      selectorModels !== null;

    operationalMetrics.setDependencyStatus("database", dependencies.database === "ok");
    operationalMetrics.setDependencyStatus("redis", dependencies.redis === "ok");
    operationalMetrics.setDependencyStatus("provider_registry", selectorModels !== null);
    operationalMetrics.setEligibleModels(selectorModels?.length ?? 0);

    if (!ready) {
      reply.status(503);
    }

    return {
      status: ready ? "ok" : "unavailable",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      database: { status: dependencies.database },
      redis: { status: dependencies.redis },
      providerRegistry: {
        status: selectorModels === null ? "unavailable" : "ok",
        eligibleChatModels: selectorModels?.length ?? 0,
      },
      loadProtection: {
        maxConcurrentRequests: getEnvInt("AI_MAX_CONCURRENT_REQUESTS", 10),
        maxConcurrentRequestsPerConversation: getEnvInt(
          "AI_MAX_CONCURRENT_REQUESTS_PER_CONVERSATION",
          2,
        ),
        chatRequestsPerMinute: getEnvInt("AI_CHAT_REQUESTS_PER_MINUTE", 30),
        maxHistoryMessages: getEnvInt("AI_MAX_HISTORY_MESSAGES", 40),
      },
    };
  };

  app.get("/api/v1/health", readinessHandler);
  app.get("/api/v1/health/ready", readinessHandler);

  app.register(async (scopedApp) => {
    await registerSessionContext(scopedApp, sessionService);

    await scopedApp.register(registerSessionRoutes, {
      prefix: "/api/v1/session",
      sessionService,
    });

    await scopedApp.register(
      async (conversationApp) => {
        await registerConversationRoutes(conversationApp, {
          conversationRepository,
        });
        await registerChatRoutes(conversationApp, {
          conversationRepository,
          chatService,
        });
      },
      {
        prefix: "/api/v1/conversations",
      },
    );

    await scopedApp.register(
      async (dashboardApp) => {
        await registerDashboardRoutes(dashboardApp, {
          dashboardService,
        });
      },
      {
        prefix: "/api/v1/dashboard",
      },
    );

    await scopedApp.register(
      async (companionApp) => {
        await registerCompanionRoutes(companionApp, {
          companionService,
        });
      },
      {
        prefix: "/api/v1/companion",
      },
    );

    await scopedApp.register(
      async (workspacesApp) => {
        await registerWorkspacesRoutes(workspacesApp, {
          workspacesService,
          companionService,
        });
      },
      {
        prefix: "/api/v1/workspaces",
      },
    );

    await scopedApp.register(
      async (providersApp) => {
        await registerProviderRoutes(providersApp, {
          modelRegistryService,
        });
      },
      {
        prefix: "/api/v1/providers",
      },
    );

    await scopedApp.register(
      async (modelsApp) => {
        await registerModelRoutes(modelsApp, {
          modelRegistryService,
        });
      },
      {
        prefix: "/api/v1/models",
      },
    );

    await scopedApp.register(
      async (eligibilityApp) => {
        await registerModelEligibilityRoutes(eligibilityApp, {
          modelEligibilityService,
        });
      },
      {
        prefix: "/api/v1/eligibility",
      },
    );

    await scopedApp.register(
      async (marketplaceApp) => {
        await registerMarketplaceRoutes(marketplaceApp, {
          marketplaceService,
        });
      },
      {
        prefix: "/api/v1/marketplace",
      },
    );

    await scopedApp.register(
      async (adminApp) => {
        await registerAdminRoutes(adminApp, {
          modelRegistryService,
        });
        await registerProviderAdminRoutes(adminApp, {
          providerManagementService,
        });
        await registerModelCatalogAdminRoutes(adminApp, {
          modelCatalogService,
        });
        await registerModelRegistryAdminRoutes(adminApp, {
          modelRegistryApprovalService,
        });
        await registerModelPolicyAdminRoutes(adminApp, {
          modelPolicyService,
        });
        await registerModelRuntimeHealthAdminRoutes(adminApp, {
          modelRuntimeHealthService,
        });
        await registerProviderHealthAdminRoutes(adminApp, {
          providerHealthService,
        });
      },
      {
        prefix: "/api/v1/admin",
      },
    );
  });

  return app;
}

export function buildProductionApp() {
  let runtimeLogger: FastifyBaseLogger | null = null;
  const operationalMetrics = createOperationalMetrics();
  const conversationRepository = createDatabaseConversationRepository();
  const analyticsService = createDatabaseModelAnalyticsService();
  const driverRegistry = createProviderDriverRegistry([
    openRouterDriver,
    geminiDriver,
  ]);
  const modelRegistryService = createDatabaseModelRegistryService({
    analyticsService,
    driverRegistry,
  });
  const marketplaceService = createMarketplaceService();
  const dashboardService = createDashboardService({
    repository: createDatabaseDashboardRepository(),
  });
  const companionService = createCompanionService({
    repository: createDatabaseCompanionRepository(),
  });
  const workspacesService = createWorkspacesService({
    repository: createDatabaseWorkspacesRepository(),
  });
  const providerManagementService = createProviderManagementService({
    providerRepository: createDatabaseProviderRepository(),
    credentialRepository: createDatabaseProviderCredentialRepository(),
    secretReader: createEnvSecretReader(),
  });
  const modelCatalogService = createModelCatalogService({
    repository: createDatabaseModelCatalogRepository(),
    providerRepository: createDatabaseModelCatalogProviderRepository(),
  });
  const modelRegistryApprovalService = createModelRegistryApprovalService({
    repository: createDatabaseModelRegistryRepository(),
    catalogReader: createDatabaseModelRegistryCatalogReader(),
  });
  const modelPolicyService = createModelPolicyService({
    repository: createDatabaseModelPolicyRepository(),
    registryReader: createDatabaseModelPolicyRegistryReader(),
  });
  const modelRuntimeHealthService = createModelRuntimeHealthService({
    repository: createDatabaseModelRuntimeHealthRepository(),
    registryReader: createDatabaseModelRuntimeHealthRegistryReader(),
  });
  const providerHealthService = createProviderHealthService({
    repository: createDatabaseProviderHealthRepository(),
    providerReader: createDatabaseProviderHealthProviderReader(),
  });
  const modelEligibilityService = createModelEligibilityService({
    sourceReader: createDatabaseEligibilitySourceReader(),
    runtimeHealthReader: modelRuntimeHealthService,
    providerHealthReader: providerHealthService,
  });
  const retentionCleanup = createRetentionCleanupService({
    policy: {
      modelUsageDays: getEnvInt("MODEL_USAGE_RETENTION_DAYS", 30),
      providerAttemptDays: getEnvInt("PROVIDER_ATTEMPT_RETENTION_DAYS", 30),
      auditDays: getEnvInt("AUDIT_EVENT_RETENTION_DAYS", 90),
      expiredSessionGraceDays: getOptionalEnvInt("EXPIRED_SESSION_GRACE_DAYS", 7),
      expiredIdempotencyGraceDays: getOptionalEnvInt(
        "EXPIRED_IDEMPOTENCY_GRACE_DAYS",
        1,
      ),
      batchSize: getEnvInt("RETENTION_CLEANUP_BATCH_SIZE", 1_000),
    },
  });

  const app = buildApp({
    operationalMetrics,
    retentionCleanup,
    readinessProbe: async () => {
      const timeoutMs = getEnvInt("READINESS_PROBE_TIMEOUT_MS", 3_000);
      const [database, redis] = await Promise.allSettled([
        withTimeout(checkDatabaseConnection(), timeoutMs, "Database readiness timed out"),
        withTimeout(checkRedisConnection(), timeoutMs, "Redis readiness timed out"),
      ]);
      return {
        database: database.status === "fulfilled" ? "ok" : "unavailable",
        redis: redis.status === "fulfilled" ? "ok" : "unavailable",
      };
    },
    sessionService: createDatabaseSessionService({
      allowDevSessionFallback:
        process.env.NODE_ENV !== "production" &&
        process.env.ALLOW_DEV_SESSION === "true",
      sessionTtlMs:
        getEnvInt("BROWSER_SESSION_TTL_HOURS", 7 * 24) * 60 * 60 * 1000,
    }),
    conversationRepository,
    modelRegistryService,
    providerManagementService,
    modelCatalogService,
    modelRegistryApprovalService,
    modelPolicyService,
    modelEligibilityService,
    modelRuntimeHealthService,
    providerHealthService,
    marketplaceService,
    dashboardService,
    companionService,
    workspacesService,
    chatService: createChatService({
      conversationRepository,
      getProviderCandidates: async () => {
        const candidates = await modelRegistryService.listRoutingCandidates("chat");
        return candidates.map((candidate) => ({
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          modelId: candidate.modelId,
          modelName: candidate.modelName,
          externalModelKey: candidate.externalModelKey,
          baseType: candidate.driverKey,
          providerPriority: candidate.providerPriority,
          modelPriority: candidate.modelPriority,
          supportsChat: candidate.supportsChat,
          supportsAgent: candidate.supportsAgent,
          supportsVision: candidate.supportsVision,
          secretRef: candidate.secretRef,
          requestsPerMinuteLimit: candidate.requestsPerMinuteLimit,
          contextWindow: candidate.contextWindow,
        }));
      },
      invokeProvider: createProviderInvoker(driverRegistry),
      cooldownTracker: globalCooldownTracker,
      recordProviderAttempt: async (input) => {
        await recordProviderAttempt(input);
        await analyticsService.recordAttempt({
          conversationId: input.conversationId,
          messageId: null,
          providerId: input.providerId,
          modelId: input.modelId,
          attemptNo: input.attemptNo,
          wasManualSelection: input.attemptNo === 1,
          wasFailover: input.attemptNo > 1,
          requestKind: "chat",
          status: input.status === "success" ? "success" : "failed",
          failureCode: input.failureCode,
          latencyMs: input.endedAt.getTime() - input.startedAt.getTime(),
          inputTokens: input.usage?.inputTokens ?? 0,
          outputTokens: input.usage?.outputTokens ?? 0,
          totalTokens: input.usage?.totalTokens ?? 0,
          costUsdMicros: 0,
          idempotencyKey: input.routingTraceId,
          createdAt: input.endedAt.toISOString(),
        });
      },
      onProviderSuccess: async ({ modelId, usage }) => {
        await modelRegistryService.markAttemptSuccess(modelId, usage);
      },
      onProviderFailure: async ({ modelId, failureCode, retryAfterSeconds }) => {
        await modelRegistryService.markAttemptFailure({
          modelId,
          failureCode,
          retryAfterSeconds,
        });
      },
      logProviderAttempt: (entry) => {
        operationalMetrics.observeProviderAttempt({
          providerId: entry.providerId,
          status: entry.status,
          failureCode: entry.errorCode,
          fallbackUsed: entry.fallbackUsed,
          latencyMs: entry.latencyMs,
        });
        runtimeLogger?.info(
          {
            event: "provider.attempt",
            requestId: entry.requestId,
            conversationId: entry.conversationId,
            selectedModelId: entry.selectedModelId ?? null,
            attemptedModelId: entry.attemptedModelId,
            providerId: entry.providerId,
            providerName: entry.providerName ?? null,
            attemptNo: entry.attemptNo,
            latencyMs: entry.latencyMs,
            status: entry.status,
            fallbackUsed: entry.fallbackUsed,
            errorCode: entry.errorCode ?? null,
            tokenUsage: entry.tokenUsage ?? null,
          },
          "Provider attempt completed",
        );
      },
      logPromptAssembly: (entry) => {
        runtimeLogger?.info(
          {
            event: "prompt.assembled",
            requestId: entry.requestId,
            conversationId: entry.conversationId,
            workspaceId: entry.workspaceId ?? null,
            modelId: entry.modelId,
            includedContextCount: entry.includedContextCount,
            excludedContextCount: entry.excludedContextCount,
            estimatedPromptTokens: entry.estimatedPromptTokens,
            truncatedContext: entry.truncatedContext,
          },
          "Prompt assembly completed",
        );
      },
      idempotencyStore: createDatabaseChatIdempotencyStore(),
      concurrencyLimiter: createInMemoryConcurrencyLimiter({
        maxGlobal: getEnvInt("AI_MAX_CONCURRENT_REQUESTS", 10),
        maxPerConversation: getEnvInt("AI_MAX_CONCURRENT_REQUESTS_PER_CONVERSATION", 2),
      }),
      chatRateLimiter: createInMemoryFixedWindowRateLimiter(),
      chatRequestsPerMinuteLimit: getEnvInt("AI_CHAT_REQUESTS_PER_MINUTE", 30),
      modelRateLimiter: createInMemoryFixedWindowRateLimiter(),
      maxProviderHistoryMessages: getEnvInt("AI_MAX_HISTORY_MESSAGES", 40),
      maxTextChars: getEnvInt("AI_MAX_USER_MESSAGE_CHARS", 20_000),
      requestDeadlineMs: getEnvInt("AI_CHAT_REQUEST_DEADLINE_MS", 90_000),
    }),
  });
  runtimeLogger = app.log;
  return app;
}

export function buildLocalRuntimeApp() {
  let runtimeLogger: FastifyBaseLogger | null = null;
  const operationalMetrics = createOperationalMetrics();
  const conversationRepository = createInMemoryConversationRepository();
  const analyticsService = createInMemoryModelAnalyticsService();
  const driverRegistry = createProviderDriverRegistry([
    openRouterDriver,
    geminiDriver,
  ]);
  const modelRegistryService = createInMemoryModelRegistryService(
    createDefaultLocalModelRegistrySeed(),
  );
  const inMemoryCompanionDevices: CompanionDeviceRecord[] = [];
  const inMemoryCompanionConnections = new Map<string, string | null>();
  const inMemoryWorkspaces: WorkspaceRecord[] = [];
  const dashboardService = createDashboardService({
    repository: createInMemoryDashboardRepository({
      sharedWorkspaces: inMemoryWorkspaces,
    }),
    getCompanionState: async () =>
      getCompanionState({
        listConnectionEntries: async () =>
          Array.from(inMemoryCompanionConnections.entries()).map(([deviceId, value]) => ({
            key: redisKeys.companionConnection(deviceId),
            value,
          })),
      }),
    getProviderSummary: async () => {
      const models = await modelRegistryService.listSelectorModels("chat");
      return {
        eligibleCount: models.length,
        cooldownCount: 0,
        lastExhaustedAt: null,
      };
    },
  });
  const companionService = createCompanionService({
    repository: createInMemoryCompanionRepository({
      sharedDevices: inMemoryCompanionDevices,
      sharedConnectionStates: inMemoryCompanionConnections,
    }),
  });
  const workspacesService = createWorkspacesService({
    repository: createInMemoryWorkspacesRepository({
      sharedDevices: inMemoryCompanionDevices,
      sharedWorkspaces: inMemoryWorkspaces,
    }),
  });
  const marketplaceService = createLocalMarketplaceService(modelRegistryService);

  const app = buildApp({
    operationalMetrics,
    readinessProbe: async () => ({
      database: "ok",
      redis: "ok",
    }),
    sessionService: createInMemorySessionService({
      allowDevSessionFallback: false,
      sessionTtlMs:
        getEnvInt("BROWSER_SESSION_TTL_HOURS", 7 * 24) * 60 * 60 * 1000,
    }),
    conversationRepository,
    modelRegistryService,
    marketplaceService,
    dashboardService,
    companionService,
    workspacesService,
    chatService: createChatService({
      conversationRepository,
      getProviderCandidates: async () => {
        const candidates = await modelRegistryService.listRoutingCandidates("chat");
        return candidates.map((candidate) => ({
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          modelId: candidate.modelId,
          modelName: candidate.modelName,
          externalModelKey: candidate.externalModelKey,
          baseType: candidate.driverKey,
          providerPriority: candidate.providerPriority,
          modelPriority: candidate.modelPriority,
          supportsChat: candidate.supportsChat,
          supportsAgent: candidate.supportsAgent,
          supportsVision: candidate.supportsVision,
          secretRef: candidate.secretRef,
          requestsPerMinuteLimit: candidate.requestsPerMinuteLimit,
          contextWindow: candidate.contextWindow,
        }));
      },
      invokeProvider: createProviderInvoker(driverRegistry),
      cooldownTracker: globalCooldownTracker,
      recordProviderAttempt: async (input) => {
        await analyticsService.recordAttempt({
          conversationId: input.conversationId,
          messageId: null,
          providerId: input.providerId,
          modelId: input.modelId,
          attemptNo: input.attemptNo,
          wasManualSelection: input.attemptNo === 1,
          wasFailover: input.attemptNo > 1,
          requestKind: "chat",
          status: input.status === "success" ? "success" : "failed",
          failureCode: input.failureCode,
          latencyMs: input.endedAt.getTime() - input.startedAt.getTime(),
          inputTokens: input.usage?.inputTokens ?? 0,
          outputTokens: input.usage?.outputTokens ?? 0,
          totalTokens: input.usage?.totalTokens ?? 0,
          costUsdMicros: 0,
          idempotencyKey: input.routingTraceId,
          createdAt: input.endedAt.toISOString(),
        });
      },
      onProviderSuccess: async ({ modelId, usage }) => {
        await modelRegistryService.markAttemptSuccess(modelId, usage);
      },
      onProviderFailure: async ({ modelId, failureCode, retryAfterSeconds }) => {
        await modelRegistryService.markAttemptFailure({
          modelId,
          failureCode,
          retryAfterSeconds,
        });
      },
      logProviderAttempt: (entry) => {
        operationalMetrics.observeProviderAttempt({
          providerId: entry.providerId,
          status: entry.status,
          failureCode: entry.errorCode,
          fallbackUsed: entry.fallbackUsed,
          latencyMs: entry.latencyMs,
        });
        runtimeLogger?.info(
          {
            event: "provider.attempt",
            conversationId: entry.conversationId,
            attemptedModelId: entry.attemptedModelId,
            providerId: entry.providerId,
            attemptNo: entry.attemptNo,
            status: entry.status,
            errorCode: entry.errorCode ?? null,
          },
          "Provider attempt completed",
        );
      },
      idempotencyStore: createInMemoryChatIdempotencyStore(),
      concurrencyLimiter: createInMemoryConcurrencyLimiter({
        maxGlobal: getEnvInt("AI_MAX_CONCURRENT_REQUESTS", 10),
        maxPerConversation: getEnvInt("AI_MAX_CONCURRENT_REQUESTS_PER_CONVERSATION", 2),
      }),
      chatRateLimiter: createInMemoryFixedWindowRateLimiter(),
      chatRequestsPerMinuteLimit: getEnvInt("AI_CHAT_REQUESTS_PER_MINUTE", 30),
      modelRateLimiter: createInMemoryFixedWindowRateLimiter(),
      maxProviderHistoryMessages: getEnvInt("AI_MAX_HISTORY_MESSAGES", 40),
      maxTextChars: getEnvInt("AI_MAX_USER_MESSAGE_CHARS", 20_000),
      requestDeadlineMs: getEnvInt("AI_CHAT_REQUEST_DEADLINE_MS", 90_000),
    }),
  });
  runtimeLogger = app.log;
  return app;
}

function createDefaultLocalModelRegistrySeed(): {
  providers: ModelRegistryProviderSeed[];
  models: ModelRegistryModelSeed[];
} {
  return {
    providers: [
      {
        id: "prv_openrouter",
        name: "OpenRouter",
        baseType: "openrouter",
        driverKey: "openrouter",
        status: "active",
        priorityRank: 1,
        defaultSecretRef: "OPENROUTER_API_KEY",
      },
      {
        id: "prv_gemini",
        name: "Google Gemini",
        baseType: "gemini",
        driverKey: "gemini",
        status: "active",
        priorityRank: 2,
        defaultSecretRef: "GEMINI_API_KEY",
      },
    ],
    models: [
      {
        id: "mdl_deepseek_chat_free",
        providerId: "prv_openrouter",
        name: "DeepSeek Chat",
        externalModelKey: "deepseek/deepseek-chat-v3-0324",
        supportsChat: true,
        supportsAgent: true,
        supportsVision: false,
        contextWindow: 131072,
        priorityRank: 1,
        adminStatus: "active",
        runtimeStatus: "healthy",
        deletedAt: null,
        cooldownUntil: null,
        secretRef: null,
        requestsPerMinuteLimit: null,
        tokensPerDayLimit: null,
        tokensUsedToday: 0,
        tokensUsedDayBucket: null,
        consecutiveFailures: 0,
        lastFailureCode: null,
        lastFailureAt: null,
        lastSuccessAt: null,
        costInputPer1mUsdMicros: 240000,
        costOutputPer1mUsdMicros: 900000,
        sourceType: "provider_catalog",
        costTier: "free",
        marketplaceStatus: "available",
        lastSyncedAt: null,
        lastTestedAt: null,
        catalogMetadataJson: null,
      },
      {
        id: "mdl_qwen3_30b_free",
        providerId: "prv_openrouter",
        name: "Qwen3 30B A3B",
        externalModelKey: "qwen/qwen3-30b-a3b",
        supportsChat: true,
        supportsAgent: true,
        supportsVision: false,
        contextWindow: 131072,
        priorityRank: 2,
        adminStatus: "active",
        runtimeStatus: "healthy",
        deletedAt: null,
        cooldownUntil: null,
        secretRef: null,
        requestsPerMinuteLimit: null,
        tokensPerDayLimit: null,
        tokensUsedToday: 0,
        tokensUsedDayBucket: null,
        consecutiveFailures: 0,
        lastFailureCode: null,
        lastFailureAt: null,
        lastSuccessAt: null,
        costInputPer1mUsdMicros: 120000,
        costOutputPer1mUsdMicros: 500000,
        sourceType: "provider_catalog",
        costTier: "free",
        marketplaceStatus: "available",
        lastSyncedAt: null,
        lastTestedAt: null,
        catalogMetadataJson: null,
      },
      {
        id: "mdl_gemini_2_flash",
        providerId: "prv_gemini",
        name: "Gemini 2.0 Flash",
        externalModelKey: "gemini-2.0-flash",
        supportsChat: true,
        supportsAgent: true,
        supportsVision: true,
        contextWindow: 1048576,
        priorityRank: 3,
        adminStatus: "active",
        runtimeStatus: "healthy",
        deletedAt: null,
        cooldownUntil: null,
        secretRef: null,
        requestsPerMinuteLimit: null,
        tokensPerDayLimit: null,
        tokensUsedToday: 0,
        tokensUsedDayBucket: null,
        consecutiveFailures: 0,
        lastFailureCode: null,
        lastFailureAt: null,
        lastSuccessAt: null,
        costInputPer1mUsdMicros: null,
        costOutputPer1mUsdMicros: null,
        sourceType: "provider_catalog",
        costTier: "free",
        marketplaceStatus: "available",
        lastSyncedAt: null,
        lastTestedAt: null,
        catalogMetadataJson: null,
      },
      {
        id: "mdl_gemini_2_flash_lite",
        providerId: "prv_gemini",
        name: "Gemini 2.0 Flash-Lite",
        externalModelKey: "gemini-2.0-flash-lite",
        supportsChat: true,
        supportsAgent: false,
        supportsVision: true,
        contextWindow: 1048576,
        priorityRank: 4,
        adminStatus: "active",
        runtimeStatus: "healthy",
        deletedAt: null,
        cooldownUntil: null,
        secretRef: null,
        requestsPerMinuteLimit: null,
        tokensPerDayLimit: null,
        tokensUsedToday: 0,
        tokensUsedDayBucket: null,
        consecutiveFailures: 0,
        lastFailureCode: null,
        lastFailureAt: null,
        lastSuccessAt: null,
        costInputPer1mUsdMicros: null,
        costOutputPer1mUsdMicros: null,
        sourceType: "provider_catalog",
        costTier: "free",
        marketplaceStatus: "available",
        lastSyncedAt: null,
        lastTestedAt: null,
        catalogMetadataJson: null,
      },
    ],
  };
}

function createLocalMarketplaceService(
  modelRegistryService: ModelRegistryService,
): MarketplaceService {
  async function listLocalFreeModels() {
    const registry = await modelRegistryService.listModels({
      includeDisabled: true,
    });
    return registry.models
      .filter((model) => model.costTier === "free")
      .map((model): FreeMarketplaceModelItem => ({
        ...model,
        owner: null,
        contextWindow:
          typeof model.catalogMetadata?.contextWindow === "number"
            ? model.catalogMetadata.contextWindow
            : null,
        inputModalities: model.supportsVision ? ["text", "image"] : ["text"],
        outputModalities: ["text"],
      }));
  }

  async function getLocalFreeModel(modelId: string) {
    const models = await listLocalFreeModels();
    const model = models.find((item) => item.id === modelId);
    if (!model) {
      throw new HttpError(404, "NOT_FOUND", "Free marketplace model not found.");
    }
    return model;
  }

  return {
    async listFreeModels() {
      return {
        models: await listLocalFreeModels(),
        lastSyncedAt: null,
      };
    },
    async syncOpenRouterFreeModels() {
      const models = await listLocalFreeModels();
      return {
        models,
        lastSyncedAt: null,
        importedCount: 0,
        updatedCount: 0,
        removedCount: 0,
      };
    },
    async enableFreeModel(modelId) {
      await modelRegistryService.updateModel(modelId, { adminStatus: "active" });
      return getLocalFreeModel(modelId);
    },
    async disableFreeModel(modelId) {
      await modelRegistryService.updateModel(modelId, { adminStatus: "disabled" });
      return getLocalFreeModel(modelId);
    },
  };
}

function createProviderInvoker(driverRegistry: ReturnType<typeof createProviderDriverRegistry>): ProviderInvoker {
  return async (candidate, prompt, _routingTraceId, controls) => {
    const driver = driverRegistry.getDriver(candidate.baseType ?? "openrouter");
    if (!driver) {
      return {
        ok: false,
        failureCode: "invalid_response",
      };
    }

    return driver.invokeChat({
      providerModelId: candidate.externalModelKey ?? candidate.modelId,
      modelName: candidate.modelName,
      providerName: candidate.providerName ?? candidate.providerId,
      secretRef: candidate.secretRef ?? null,
      prompt,
      timeoutMs: controls?.timeoutMs,
    });
  };
}

function getAllowedCorsOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(
    new Set([
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      ...configuredOrigins,
    ]),
  );
}

function getLoggerOptions(): FastifyServerOptions["logger"] {
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return false;
  }

  return {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      censor: "[REDACTED]",
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "password",
        "*.password",
        "apiKey",
        "*.apiKey",
        "providerKey",
        "*.providerKey",
        "secret",
        "*.secret",
      ],
    },
  };
}

function isMetricsRequestAuthorized(authorization: string | undefined) {
  const expectedToken = process.env.METRICS_TOKEN;
  if (!expectedToken) return process.env.NODE_ENV !== "production";
  if (!authorization?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(expectedToken);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function getEnvInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function getOptionalEnvInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
