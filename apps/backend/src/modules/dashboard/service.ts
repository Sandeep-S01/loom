import type {
  DashboardCompanionStatus,
  DashboardProviderSummary,
  DashboardResponse,
} from "@clm/shared-types";
import { listDashboardProviderModels } from "../providers/repository.js";
import {
  listCompanionConnectionEntries,
  type RedisKeyValueEntry,
} from "../../redis/dashboard.js";
import type { DashboardRepository } from "./repository.js";

export interface DashboardService {
  getDashboard(userId: string): Promise<DashboardResponse>;
}

export interface CreateDashboardServiceOptions {
  repository: DashboardRepository;
  getCompanionState?: () => Promise<DashboardCompanionStatus>;
  getProviderSummary?: () => Promise<DashboardProviderSummary>;
}

type DashboardProviderModel = {
  providerId: string;
  modelId: string;
  active: boolean;
  adminStatus?: string;
  runtimeStatus?: string;
  cooldownUntil?: Date | null;
  deletedAt?: Date | null;
  secretRef?: string | null;
  defaultSecretRef?: string | null;
  supportsChat: boolean;
  supportsAgent: boolean;
  tokensPerDayLimit?: number | null;
  tokensUsedToday?: number;
  tokensUsedDayBucket?: string | Date | null;
  providerStatus: string;
};

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
  return (
    item.active &&
    (item.adminStatus ?? "active") === "active" &&
    item.runtimeStatus !== "open_circuit" &&
    item.runtimeStatus !== "auth_invalid" &&
    item.providerStatus !== "disabled" &&
    !item.deletedAt &&
    isDashboardModelSupported(item) &&
    isDashboardSecretConfigured(item)
  );
}

function isDashboardSecretConfigured(item: DashboardProviderModel) {
  const secretRef = item.secretRef ?? item.defaultSecretRef ?? null;
  return Boolean(secretRef && process.env[secretRef]);
}

function getDashboardTokensUsedToday(item: DashboardProviderModel) {
  const bucketValue =
    item.tokensUsedDayBucket instanceof Date
      ? item.tokensUsedDayBucket.toISOString()
      : item.tokensUsedDayBucket ?? null;
  const today = new Date().toISOString().slice(0, 10);
  if (!bucketValue || bucketValue.slice(0, 10) !== today) {
    return 0;
  }
  return item.tokensUsedToday ?? 0;
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

  const eligibleModels = models.filter((item) => {
    if (!isDashboardModelBaseEligible(item)) {
      return false;
    }

    if (item.cooldownUntil && item.cooldownUntil.getTime() > Date.now()) {
      return false;
    }

    if (
      item.tokensPerDayLimit != null &&
      getDashboardTokensUsedToday(item) >= item.tokensPerDayLimit
    ) {
      return false;
    }

    return true;
  });
  const cooldownCount = models.filter((item) => {
    if (!isDashboardModelBaseEligible(item)) {
      return false;
    }

    return Boolean(item.cooldownUntil && item.cooldownUntil.getTime() > Date.now());
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
