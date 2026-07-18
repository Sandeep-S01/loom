import { describe, expect, it } from "vitest";
import type {
  DashboardConversationItem,
  DashboardRunItem,
  DashboardWorkspaceItem,
} from "@clm/shared-types";
import {
  createInMemoryDashboardRepository,
} from "./repository.js";
import {
  createDashboardService,
  getCompanionState,
  getProviderSummary,
} from "./service.js";
import { redisKeys } from "../../redis/keys.js";

describe("dashboard service", () => {
  it("returns an empty-state payload when no data exists", async () => {
    const service = createDashboardService({
      repository: createInMemoryDashboardRepository(),
      getCompanionState: async () => ({
        connected: false,
        machineLabel: null,
      }),
      getProviderSummary: async () => ({
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      }),
    });

    await expect(service.getDashboard("usr_seeded")).resolves.toEqual({
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

  it("returns recent conversations in repository order", async () => {
    const recentConversations: DashboardConversationItem[] = [
      {
        id: "con_oldest",
        mode: "agent",
        title: "Oldest",
        lastMessageAt: "2026-07-04T07:00:00.000Z",
        updatedAt: "2026-07-04T07:00:00.000Z",
      },
      {
        id: "con_newest",
        mode: "chat",
        title: "Newest",
        lastMessageAt: "2026-07-04T08:00:00.000Z",
        updatedAt: "2026-07-04T08:00:00.000Z",
      },
    ];
    const recentAgentRuns: DashboardRunItem[] = [];
    const activeWorkspace: DashboardWorkspaceItem | null = null;

    const service = createDashboardService({
      repository: {
        async listRecentConversations() {
          return recentConversations;
        },
        async listRecentAgentRuns() {
          return recentAgentRuns;
        },
        async getActiveWorkspace() {
          return activeWorkspace;
        },
      },
      getCompanionState: async () => ({
        connected: true,
        machineLabel: "Devbox",
      }),
      getProviderSummary: async () => ({
        eligibleCount: 2,
        cooldownCount: 1,
        lastExhaustedAt: "2026-07-04T06:00:00.000Z",
      }),
    });

    const response = await service.getDashboard("usr_seeded");

    expect(response.recentConversations.map((item) => item.id)).toEqual([
      "con_oldest",
      "con_newest",
    ]);
  });

  it("falls back to disconnected companion state when no redis state exists", async () => {
    const service = createDashboardService({
      repository: createInMemoryDashboardRepository(),
      getCompanionState: async () => {
        throw new Error("redis unavailable");
      },
      getProviderSummary: async () => {
        throw new Error("provider summary unavailable");
      },
    });

    const response = await service.getDashboard("usr_seeded");

    expect(response.companion).toEqual({
      connected: false,
      machineLabel: null,
    });
    expect(response.providerSummary).toEqual({
      eligibleCount: 0,
      cooldownCount: 0,
      lastExhaustedAt: null,
    });
  });

  it("resolves companion state from redis-backed payloads", async () => {
    const companion = await getCompanionState({
      listConnectionEntries: async () => [
        {
          key: redisKeys.companionConnection("devbox_01"),
          value: JSON.stringify({
            machineLabel: "Devbox",
          }),
        },
      ],
    });

    expect(companion).toEqual({
      connected: true,
      machineLabel: "Devbox",
    });
  });

  it("counts eligible and cooldown models correctly", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    try {
      const summary = await getProviderSummary({
        listModels: async () => [
          {
            providerId: "prv_active",
            modelId: "mdl_ready",
            active: true,
            adminStatus: "active",
            cooldownUntil: null,
            deletedAt: null,
            defaultSecretRef: "OPENROUTER_API_KEY",
            supportsChat: true,
            supportsAgent: false,
            providerStatus: "active",
          },
          {
            providerId: "prv_active",
            modelId: "mdl_cooldown",
            active: true,
            adminStatus: "active",
            cooldownUntil: new Date(Date.now() + 60_000),
            deletedAt: null,
            defaultSecretRef: "OPENROUTER_API_KEY",
            supportsChat: false,
            supportsAgent: true,
            providerStatus: "active",
          },
          {
            providerId: "prv_disabled",
            modelId: "mdl_disabled",
            active: true,
            adminStatus: "active",
            cooldownUntil: null,
            deletedAt: null,
            defaultSecretRef: "OPENROUTER_API_KEY",
            supportsChat: true,
            supportsAgent: true,
            providerStatus: "disabled",
          },
          {
            providerId: "prv_active",
            modelId: "mdl_inactive",
            active: false,
            adminStatus: "active",
            cooldownUntil: null,
            deletedAt: null,
            defaultSecretRef: "OPENROUTER_API_KEY",
            supportsChat: true,
            supportsAgent: true,
            providerStatus: "active",
          },
          {
            providerId: "prv_active",
            modelId: "mdl_unsupported",
            active: true,
            adminStatus: "active",
            cooldownUntil: null,
            deletedAt: null,
            defaultSecretRef: "OPENROUTER_API_KEY",
            supportsChat: false,
            supportsAgent: false,
            providerStatus: "active",
          },
        ],
      });

      expect(summary).toEqual({
        eligibleCount: 1,
        cooldownCount: 1,
        lastExhaustedAt: null,
      });
    } finally {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("falls back to a disconnected companion state when redis reads fail", async () => {
    const companion = await getCompanionState({
      listConnectionEntries: async () => {
        throw new Error("redis unavailable");
      },
    });

    expect(companion).toEqual({
      connected: false,
      machineLabel: null,
    });
  });

  it("surfaces an active workspace from the shared in-memory dashboard repository", async () => {
    const service = createDashboardService({
      repository: createInMemoryDashboardRepository({
        sharedWorkspaces: [
          {
            id: "wrk_primary",
            userId: "usr_seeded",
            alias: "clm_tool",
            status: "active",
            displayPathHint: "D:/Personal_Project/clm_tool",
            lastUsedAt: "2026-07-04T10:15:00.000Z",
            updatedAt: "2026-07-04T10:15:00.000Z",
          },
        ],
      }),
      getCompanionState: async () => ({
        connected: true,
        machineLabel: "Devbox",
      }),
      getProviderSummary: async () => ({
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      }),
    });

    const response = await service.getDashboard("usr_seeded");

    expect(response.activeWorkspace).toEqual({
      id: "wrk_primary",
      alias: "clm_tool",
      status: "active",
      displayPathHint: "D:/Personal_Project/clm_tool",
      lastUsedAt: "2026-07-04T10:15:00.000Z",
    });
    expect(response.companion).toEqual({
      connected: true,
      machineLabel: "Devbox",
    });
  });
});
