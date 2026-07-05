import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { createInMemoryCompanionRepository } from "./modules/companion/repository.js";
import { createCompanionService } from "./modules/companion/service.js";
import { createInMemoryWorkspacesRepository } from "./modules/workspaces/repository.js";
import { createWorkspacesService } from "./modules/workspaces/service.js";

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }

  vi.useRealTimers();
});

describe("session bootstrap", () => {
  it("returns the seeded single user", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/session",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: "usr_seeded",
        displayName: "Primary User",
        email: "user@clm.local",
      },
    });
  }, 10000);
});

describe("conversation routes", () => {
  it("creates and lists chat conversations for the session user", async () => {
    app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        mode: "chat",
        title: "New Conversation",
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().conversation.mode).toBe("chat");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/conversations",
      cookies: createResponse.cookies.reduce<Record<string, string>>((acc, cookie) => {
        acc[cookie.name] = cookie.value;
        return acc;
      }, {}),
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().conversations).toHaveLength(1);
    expect(listResponse.json().conversations[0].title).toBe("New Conversation");
  });

  it("returns a structured 404 error for an unknown conversation", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/conversations/con_missing/messages",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Conversation not found",
        requestId: expect.any(String),
      },
    });
  });

  it("returns a structured 400 error for invalid message content", async () => {
    app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        mode: "chat",
        title: "Validation Thread",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${createResponse.json().conversation.id}/messages`,
      payload: {
        content: [],
      },
      cookies: createResponse.cookies.reduce<Record<string, string>>((acc, cookie) => {
        acc[cookie.name] = cookie.value;
        return acc;
      }, {}),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Message content is required",
        requestId: expect.any(String),
      },
    });
  });
});

describe("dashboard routes", () => {
  it("returns an empty dashboard payload for a new session", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      recentConversations: [],
      recentAgentRuns: [],
      activeWorkspace: null,
      companion: {
        connected: false,
        machineLabel: null,
      },
      providerSummary: {
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      },
    });
  });

  it("returns recent conversations ordered newest first", async () => {
    app = buildApp({
      dashboardService: {
        getDashboard: async () => ({
          recentConversations: [
            {
              id: "con_newest",
              mode: "chat",
              title: "Newest Conversation",
              lastMessageAt: "2026-07-04T09:30:00.000Z",
              updatedAt: "2026-07-04T09:30:00.000Z",
            },
            {
              id: "con_older",
              mode: "agent",
              title: "Older Conversation",
              lastMessageAt: "2026-07-04T08:15:00.000Z",
              updatedAt: "2026-07-04T08:15:00.000Z",
            },
          ],
          recentAgentRuns: [
            {
              id: "run_latest",
              conversationId: "con_newest",
              workspaceId: "ws_active",
              objective: "Investigate route coverage",
              status: "completed",
              createdAt: "2026-07-04T09:00:00.000Z",
              updatedAt: "2026-07-04T09:20:00.000Z",
            },
          ],
          activeWorkspace: {
            id: "ws_active",
            alias: "backend",
            status: "active",
            displayPathHint: "D:/Personal_Project/clm_tool",
            lastUsedAt: "2026-07-04T09:25:00.000Z",
          },
          companion: {
            connected: true,
            machineLabel: "Devbox",
          },
          providerSummary: {
            eligibleCount: 2,
            cooldownCount: 1,
            lastExhaustedAt: "2026-07-04T07:45:00.000Z",
          },
        }),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      recentConversations: [
        {
          id: "con_newest",
          mode: "chat",
          title: "Newest Conversation",
          lastMessageAt: "2026-07-04T09:30:00.000Z",
          updatedAt: "2026-07-04T09:30:00.000Z",
        },
        {
          id: "con_older",
          mode: "agent",
          title: "Older Conversation",
          lastMessageAt: "2026-07-04T08:15:00.000Z",
          updatedAt: "2026-07-04T08:15:00.000Z",
        },
      ],
      recentAgentRuns: [
        {
          id: "run_latest",
          conversationId: "con_newest",
          workspaceId: "ws_active",
          objective: "Investigate route coverage",
          status: "completed",
          createdAt: "2026-07-04T09:00:00.000Z",
          updatedAt: "2026-07-04T09:20:00.000Z",
        },
      ],
      activeWorkspace: {
        id: "ws_active",
        alias: "backend",
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
        lastUsedAt: "2026-07-04T09:25:00.000Z",
      },
      companion: {
        connected: true,
        machineLabel: "Devbox",
      },
      providerSummary: {
        eligibleCount: 2,
        cooldownCount: 1,
        lastExhaustedAt: "2026-07-04T07:45:00.000Z",
      },
    });
  });

  it("returns a structured 500 error when session user is unavailable", async () => {
    app = buildApp();
    app.addHook("preHandler", async (request) => {
      if (request.url === "/api/v1/dashboard") {
        request.sessionUser = null;
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Session user is not available",
        requestId: expect.any(String),
      },
    });
  });
});

describe("companion pairing", () => {
  it("creates a short-lived pairing challenge", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      pairingCode: expect.stringMatching(/^pair_/),
      expiresAt: expect.any(String),
    });
  });

  it("rejects an expired pairing code", async () => {
    app = buildApp({
      companionService: createCompanionService({
        repository: createInMemoryCompanionRepository({
          now: () => new Date("2026-07-04T12:10:00.000Z"),
          initialState: {
            challenges: [
              {
                pairingCode: "pair_expired",
                userId: "usr_seeded",
                expiresAt: "2026-07-04T12:05:00.000Z",
                usedAt: null,
              },
            ],
          },
        }),
      }),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: "pair_expired",
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:expired",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Pairing code has expired",
        requestId: expect.any(String),
      },
    });
  });

  it("completes pairing and returns machine credentials", async () => {
    app = buildApp();

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
    });

    const completionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: startResponse.json().pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:device",
      },
    });

    expect(completionResponse.statusCode).toBe(200);
    expect(completionResponse.json()).toEqual({
      deviceId: expect.stringMatching(/^dev_/),
      machineSessionToken: expect.stringMatching(/^machine_/),
    });

    const statusResponse = await app.inject({
      method: "GET",
      url: "/api/v1/companion/status",
    });

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toEqual({
      connected: true,
      machineLabel: "Devbox",
      deviceId: completionResponse.json().deviceId,
    });
  });
});

describe("workspaces", () => {
  it("lists known workspaces for the current user", async () => {
    app = buildApp({
      workspacesService: createWorkspacesService({
        repository: createInMemoryWorkspacesRepository({
          initialState: {
            workspaces: [
              {
                id: "ws_latest",
                userId: "usr_seeded",
                machineId: "dev_seeded",
                alias: "backend",
                canonicalPathHash: "sha256:path-a",
                displayPathHint: "D:/Personal_Project/clm_tool",
                status: "active",
                createdAt: "2026-07-04T09:00:00.000Z",
                updatedAt: "2026-07-04T09:05:00.000Z",
                lastUsedAt: "2026-07-04T09:05:00.000Z",
              },
            ],
          },
        }),
      }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      workspaces: [
        {
          id: "ws_latest",
          alias: "backend",
          machineId: "dev_seeded",
          status: "active",
          displayPathHint: "D:/Personal_Project/clm_tool",
        },
      ],
    });
  });

  it("creates or updates a workspace binding", async () => {
    app = buildApp({
      workspacesService: createWorkspacesService({
        repository: createInMemoryWorkspacesRepository({
          now: () => new Date("2026-07-04T10:15:00.000Z"),
          initialState: {
            devices: [
              {
                id: "dev_seeded",
                userId: "usr_seeded",
                deviceType: "desktop_companion",
                machineLabel: "Devbox",
                machineFingerprintHash: "sha256:devbox",
                lastSeenAt: "2026-07-04T10:00:00.000Z",
                createdAt: "2026-07-04T09:00:00.000Z",
              },
            ],
            workspaces: [
              {
                id: "ws_existing",
                userId: "usr_seeded",
                machineId: "dev_seeded",
                alias: "old-name",
                canonicalPathHash: "sha256:path-a",
                displayPathHint: "D:/Old",
                status: "missing",
                createdAt: "2026-07-04T09:05:00.000Z",
                updatedAt: "2026-07-04T09:10:00.000Z",
                lastUsedAt: "2026-07-04T09:10:00.000Z",
              },
            ],
          },
        }),
      }),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/select",
      payload: {
        machineId: "dev_seeded",
        alias: "backend",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      workspace: {
        id: "ws_existing",
        alias: "backend",
        machineId: "dev_seeded",
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });
  });

  it("supports the default pair-then-select flow end-to-end", async () => {
    app = buildApp();

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
    });

    const pairResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: startResponse.json().pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:device",
      },
    });

    const selectResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/select",
      payload: {
        machineId: pairResponse.json().deviceId,
        alias: "backend",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });

    expect(selectResponse.statusCode).toBe(200);
    expect(selectResponse.json()).toEqual({
      workspace: {
        id: expect.stringMatching(/^wrk_/),
        alias: "backend",
        machineId: pairResponse.json().deviceId,
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });
  });

  it("surfaces paired companion and active workspace state in the dashboard payload", async () => {
    app = buildApp();

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
    });

    const pairResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: startResponse.json().pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:device",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/select",
      payload: {
        machineId: pairResponse.json().deviceId,
        alias: "clm_tool",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.json()).toEqual({
      recentConversations: [],
      recentAgentRuns: [],
      activeWorkspace: {
        id: expect.stringMatching(/^wrk_/),
        alias: "clm_tool",
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
        lastUsedAt: expect.any(String),
      },
      companion: {
        connected: true,
        machineLabel: "Devbox",
      },
      providerSummary: {
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      },
    });
  });
});

describe("production app wiring", () => {
  it("uses the real dashboard resolvers and database dashboard repository in the production app path", async () => {
    vi.resetModules();

    const createDatabaseDashboardRepository = vi.fn(() => ({
      listRecentConversations: async () => [],
      listRecentAgentRuns: async () => [],
      getActiveWorkspace: async () => null,
    }));
    const createDatabaseCompanionRepository = vi.fn(() => ({
      createPairingChallenge: async () => ({
        pairingCode: "pair_stub",
        expiresAt: "2026-07-04T12:05:00.000Z",
      }),
      completePairing: async () => ({
        deviceId: "dev_stub",
        machineSessionToken: "machine_stub",
      }),
      getCompanionStatus: async () => ({
        connected: false,
        machineLabel: null,
        deviceId: null,
      }),
    }));
    const createDatabaseWorkspacesRepository = vi.fn(() => ({
      listForUser: async () => [],
      selectWorkspace: async () => ({
        workspace: {
          id: "ws_stub",
          alias: "stub",
          machineId: "dev_stub",
          status: "active",
          displayPathHint: null,
        },
      }),
    }));
    const createDashboardService = vi.fn(() => ({
      getDashboard: async () => ({
        recentConversations: [],
        recentAgentRuns: [],
        activeWorkspace: null,
        companion: {
          connected: false,
          machineLabel: null,
        },
        providerSummary: {
          eligibleCount: 0,
          cooldownCount: 0,
          lastExhaustedAt: null,
        },
      }),
    }));

    vi.doMock("./modules/conversations/repository.js", () => ({
      createDatabaseConversationRepository: vi.fn(() => ({})),
      createInMemoryConversationRepository: vi.fn(() => ({})),
    }));
    vi.doMock("./modules/session/service.js", () => ({
      createDatabaseSessionService: vi.fn(() => ({})),
      createInMemorySessionService: vi.fn(() => ({})),
    }));
    vi.doMock("./modules/chat/service.js", () => ({
      createChatService: vi.fn(() => ({})),
    }));
    vi.doMock("./modules/providers/repository.js", () => ({
      listEligibleChatModels: vi.fn(async () => []),
      recordProviderAttempt: vi.fn(),
    }));
    vi.doMock("./modules/dashboard/repository.js", () => ({
      createDatabaseDashboardRepository,
      createInMemoryDashboardRepository: vi.fn(() => ({
        listRecentConversations: async () => [],
        listRecentAgentRuns: async () => [],
        getActiveWorkspace: async () => null,
      })),
    }));
    vi.doMock("./modules/companion/repository.js", () => ({
      createDatabaseCompanionRepository,
      createInMemoryCompanionRepository: vi.fn(() => ({
        createPairingChallenge: async () => ({
          pairingCode: "pair_stub",
          expiresAt: "2026-07-04T12:05:00.000Z",
        }),
        completePairing: async () => ({
          deviceId: "dev_stub",
          machineSessionToken: "machine_stub",
        }),
        getCompanionStatus: async () => ({
          connected: false,
          machineLabel: null,
          deviceId: null,
        }),
      })),
    }));
    vi.doMock("./modules/companion/service.js", () => ({
      createCompanionService: vi.fn((options) => ({
        startPairing: async (userId: string) =>
          options.repository.createPairingChallenge(userId),
        completePairing: async (input: {
          pairingCode: string;
          machineLabel: string;
          machineFingerprintHash: string;
        }) => options.repository.completePairing(input),
        getStatus: async (userId: string) =>
          options.repository.getCompanionStatus(userId),
      })),
    }));
    const createWorkspacesService = vi.fn((options) => ({
      listForUser: async (userId: string) => ({
        workspaces: await options.repository.listForUser(userId),
      }),
      selectWorkspace: async (
        userId: string,
        input: {
          machineId: string;
          alias: string;
          canonicalPathHash: string;
          displayPathHint?: string;
        },
      ) => options.repository.selectWorkspace(userId, input),
    }));
    vi.doMock("./modules/dashboard/service.js", () => ({
      createDashboardService,
    }));
    vi.doMock("./modules/workspaces/repository.js", () => ({
      createDatabaseWorkspacesRepository,
      createInMemoryWorkspacesRepository: vi.fn(() => ({
        listForUser: async () => [],
        selectWorkspace: async () => ({
          workspace: {
            id: "ws_stub",
            alias: "stub",
            machineId: "dev_stub",
            status: "active",
            displayPathHint: null,
          },
        }),
      })),
    }));
    vi.doMock("./modules/workspaces/service.js", () => ({
      createWorkspacesService,
    }));
    vi.doMock("./modules/conversations/routes.js", () => ({
      registerConversationRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/chat/routes.js", () => ({
      registerChatRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/session/routes.js", () => ({
      registerSessionRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./plugins/session.js", () => ({
      registerSessionContext: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/dashboard/routes.js", () => ({
      registerDashboardRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/companion/routes.js", () => ({
      registerCompanionRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/workspaces/routes.js", () => ({
      registerWorkspacesRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/providers/gemini-client.js", () => ({
      invokeGemini: vi.fn(),
    }));
    vi.doMock("./modules/providers/openrouter-client.js", () => ({
      invokeOpenRouter: vi.fn(),
    }));

    const { buildProductionApp } = await import("./app.js");
    const productionApp = buildProductionApp();
    await productionApp.close();

    expect(createDashboardService).toHaveBeenCalledTimes(1);
    expect(createDatabaseDashboardRepository).toHaveBeenCalledTimes(1);
    expect(createDatabaseCompanionRepository).toHaveBeenCalledTimes(1);
    expect(createDatabaseWorkspacesRepository).toHaveBeenCalledTimes(1);
    expect(createDashboardService).toHaveBeenCalledWith({
      repository: createDatabaseDashboardRepository.mock.results[0]?.value,
    });
    expect(createWorkspacesService).toHaveBeenCalledWith({
      repository: createDatabaseWorkspacesRepository.mock.results[0]?.value,
    });
  });
});
