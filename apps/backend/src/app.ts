import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
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
  type ProviderCandidate,
  type ProviderInvoker,
} from "./modules/chat/service.js";
import {
  createDatabaseSessionService,
  createInMemorySessionService,
  type SessionService,
} from "./modules/session/service.js";
import { registerSessionRoutes } from "./modules/session/routes.js";
import { registerSessionContext } from "./plugins/session.js";
import {
  listEligibleModels,
  recordProviderAttempt,
} from "./modules/providers/repository.js";
import { globalCooldownTracker } from "./modules/providers/cooldown-tracker.js";
import { invokeGemini } from "./modules/providers/gemini-client.js";
import { invokeOpenRouter } from "./modules/providers/openrouter-client.js";
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

interface BuildAppOptions {
  sessionService?: SessionService;
  conversationRepository?: ConversationRepository;
  chatService?: ChatService;
  dashboardService?: DashboardService;
  companionService?: CompanionService;
  workspacesService?: WorkspacesService;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: false,
  });

  const allowedCorsOrigins = getAllowedCorsOrigins();
  const inMemoryCompanionDevices: CompanionDeviceRecord[] = [];
  const inMemoryCompanionConnections = new Map<string, string | null>();
  const inMemoryWorkspaces: WorkspaceRecord[] = [];
  const sessionService =
    options.sessionService ?? createInMemorySessionService();
  const conversationRepository =
    options.conversationRepository ?? createInMemoryConversationRepository();
  const chatService =
    options.chatService ??
    createChatService({
      conversationRepository,
      providerCandidates: [],
      invokeProvider: async () => ({
        ok: false,
        failureCode: "quota_exhausted",
      }),
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

    request.log.error(error);
    reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected backend failure",
        requestId: request.id,
      },
    });
  });

  app.get("/api/v1/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  app.register(async (scopedApp) => {
    await registerSessionContext(scopedApp, sessionService);

    await scopedApp.register(registerSessionRoutes, {
      prefix: "/api/v1/session",
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
        });
      },
      {
        prefix: "/api/v1/workspaces",
      },
    );
  });

  return app;
}

export function buildProductionApp() {
  const conversationRepository = createDatabaseConversationRepository();
  const dashboardService = createDashboardService({
    repository: createDatabaseDashboardRepository(),
  });
  const companionService = createCompanionService({
    repository: createDatabaseCompanionRepository(),
  });
  const workspacesService = createWorkspacesService({
    repository: createDatabaseWorkspacesRepository(),
  });

  return buildApp({
    sessionService: createDatabaseSessionService(),
    conversationRepository,
    dashboardService,
    companionService,
    workspacesService,
    chatService: createChatService({
      conversationRepository,
      getProviderCandidates: async () => {
        // Fetch all active models (mode-based filtering happens in the router)
        const chatModels = await listEligibleModels("chat");
        const agentModels = await listEligibleModels("agent");
        // Merge and deduplicate by modelId
        const seen = new Set<string>();
        const merged: ProviderCandidate[] = [];
        for (const model of [...chatModels, ...agentModels]) {
          if (!seen.has(model.modelId)) {
            seen.add(model.modelId);
            merged.push({
              providerId: model.providerId,
              modelId: model.modelId,
              modelName: model.modelName,
              externalModelKey: model.externalModelKey,
              baseType: model.baseType,
              providerPriority: model.providerPriority,
              modelPriority: model.modelPriority,
              supportsChat: chatModels.some((m) => m.modelId === model.modelId),
              supportsAgent: agentModels.some((m) => m.modelId === model.modelId),
            });
          }
        }
        return merged;
      },
      invokeProvider: createProviderInvoker(),
      cooldownTracker: globalCooldownTracker,
      recordProviderAttempt,
    }),
  });
}

function createProviderInvoker(): ProviderInvoker {
  return async (candidate, history) => {
    if (candidate.baseType === "gemini" && candidate.externalModelKey) {
      return invokeGemini(
        {
          providerId: candidate.providerId,
          providerName: "Google Gemini",
          modelId: candidate.modelId,
          modelName: candidate.modelName,
          externalModelKey: candidate.externalModelKey,
          providerPriority: candidate.providerPriority ?? 1,
          modelPriority: candidate.modelPriority ?? 1,
          baseType: "gemini",
        },
        history,
      );
    }

    return invokeOpenRouter(
      {
        providerId: candidate.providerId,
        providerName: "OpenRouter",
        modelId: candidate.modelId,
        modelName: candidate.modelName,
        externalModelKey: candidate.externalModelKey ?? candidate.modelId,
        providerPriority: candidate.providerPriority ?? 1,
        modelPriority: candidate.modelPriority ?? 1,
        baseType: candidate.baseType ?? "openrouter",
      },
      history,
    );
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
