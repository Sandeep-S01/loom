import type {
  DashboardCompanionStatus,
  DashboardProviderSummary,
  DashboardResponse,
} from "@clm/shared-types";
import { listDashboardProviderModels } from "../providers/repository.js";
import {
  listCompanionConnectionEntries,
  listProviderCooldownKeys,
  type RedisKeyValueEntry,
} from "../../redis/dashboard.js";
import { redisKeys } from "../../redis/keys.js";
import type { DashboardRepository } from "./repository.js";

export interface DashboardService {
  getDashboard(userId: string): Promise<DashboardResponse>;
}

export interface CreateDashboardServiceOptions {
  repository: DashboardRepository;
  getCompanionState?: () => Promise<DashboardCompanionStatus>;
  getProviderSummary?: () => Promise<DashboardProviderSummary>;
}

type DashboardProviderModel = Awaited<
  ReturnType<typeof listDashboardProviderModels>
>[number];

export interface CompanionStateResolverOptions {
  listConnectionEntries?: () => Promise<RedisKeyValueEntry[]>;
}

export interface ProviderSummaryResolverOptions {
  listModels?: () => Promise<DashboardProviderModel[]>;
  listCooldownKeys?: () => Promise<string[]>;
}

function getDisconnectedCompanionState(): DashboardCompanionStatus {
  return {
    connected: false,
    machineLabel: null,
  };
}

function isDashboardModelSupported(item: DashboardProviderModel) {
  return item.supportsChat || item.supportsAgent;
}

function isDashboardModelBaseEligible(item: DashboardProviderModel) {
  return item.active && item.providerStatus !== "disabled" && isDashboardModelSupported(item);
}

function parseCompanionConnectionValue(
  value: string | null,
): DashboardCompanionStatus | null {
  if (!value) {
    return null;
  }

  if (value === "1" || value === "true" || value === "connected") {
    return {
      connected: true,
      machineLabel: null,
    };
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const machineLabel =
      typeof parsed.machineLabel === "string"
        ? parsed.machineLabel
        : typeof parsed.machine_label === "string"
          ? parsed.machine_label
          : null;

    if (typeof parsed.connected === "boolean") {
      return {
        connected: parsed.connected,
        machineLabel,
      };
    }

    return {
      connected: true,
      machineLabel,
    };
  } catch {
    return null;
  }
}

export async function getCompanionState(
  options: CompanionStateResolverOptions = {},
): Promise<DashboardCompanionStatus> {
  const listEntries = options.listConnectionEntries ?? listCompanionConnectionEntries;

  try {
    const connections = await listEntries();

    for (const connection of connections) {
      const parsed = parseCompanionConnectionValue(connection.value);
      if (parsed?.connected) {
        return parsed;
      }
    }
  } catch {
    return getDisconnectedCompanionState();
  }

  return getDisconnectedCompanionState();
}

export async function getProviderSummary(
  options: ProviderSummaryResolverOptions = {},
): Promise<DashboardResponse["providerSummary"]> {
  const listModels = options.listModels ?? listDashboardProviderModels;
  const models = await listModels();
  let cooldownModelIds = new Set<string>();

  try {
    const listCooldownKeys = options.listCooldownKeys ?? listProviderCooldownKeys;
    cooldownModelIds = new Set(
      (await listCooldownKeys())
        .map((key) => redisKeys.parseProviderCooldownModelId(key))
        .filter((modelId): modelId is string => modelId !== null),
    );
  } catch {
    cooldownModelIds = new Set<string>();
  }

  const eligibleModels = models.filter((item) => {
    if (!isDashboardModelBaseEligible(item)) {
      return false;
    }

    return !cooldownModelIds.has(item.modelId);
  });
  const cooldownCount = models.filter((item) => {
    if (!isDashboardModelBaseEligible(item)) {
      return false;
    }

    return cooldownModelIds.has(item.modelId);
  }).length;

  return {
    eligibleCount: eligibleModels.length,
    cooldownCount,
    lastExhaustedAt: null,
  };
}

export function createDashboardService(
  options: CreateDashboardServiceOptions,
): DashboardService {
  const resolveCompanionState = options.getCompanionState ?? getCompanionState;
  const resolveProviderSummary = options.getProviderSummary ?? getProviderSummary;

  return {
    async getDashboard(userId) {
      const [recentConversations, recentAgentRuns, activeWorkspace] =
        await Promise.all([
          options.repository.listRecentConversations(userId),
          options.repository.listRecentAgentRuns(userId),
          options.repository.getActiveWorkspace(userId),
        ]);

      const companion = await resolveCompanionState().catch(() => ({
        ...getDisconnectedCompanionState(),
      }));

      const providerSummary = await resolveProviderSummary().catch(() => ({
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      }));

      return {
        recentConversations,
        recentAgentRuns,
        activeWorkspace,
        companion,
        providerSummary,
      };
    },
  };
}
