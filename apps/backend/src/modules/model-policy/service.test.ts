import { describe, expect, it, vi } from "vitest";
import type { ModelPolicyRecord } from "./domain.js";
import {
  createInMemoryModelPolicyRegistryReader,
  createInMemoryModelPolicyRepository,
} from "./repository.js";
import { createModelPolicyService } from "./service.js";

const now = new Date("2026-07-19T00:00:00.000Z");

describe("model policy service", () => {
  it("upserts policy rules for registered models without eligibility or routing state", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = createModelPolicyService({
      repository: createInMemoryModelPolicyRepository(),
      registryReader: createInMemoryModelPolicyRegistryReader([
        makeRegistryReference("mreg_deepseek"),
      ]),
      logger,
    });

    const result = await service.upsertPolicy({
      registryModelId: "mreg_deepseek",
      actorUserId: "usr_admin",
      patch: {
        enabled: true,
        visibleInSelector: true,
        priorityRank: 10,
        defaultForChat: true,
        requiresCompanion: false,
        requestsPerMinuteLimit: 60,
        tokensPerDayLimit: 100_000,
        tokensPerRequestLimit: 8_000,
        notes: "Primary free chat model",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        registryModelId: "mreg_deepseek",
        enabled: true,
        priorityRank: 10,
        defaultForChat: true,
      }),
    );
    expect(result).not.toHaveProperty("eligible");
    expect(result).not.toHaveProperty("runtimeStatus");
    expect(result).not.toHaveProperty("routingScore");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "model_policy.policy_upserted",
        registryModelId: "mreg_deepseek",
      }),
      "Model policy upserted",
    );
  });

  it("rejects missing or archived registry models", async () => {
    const service = createModelPolicyService({
      repository: createInMemoryModelPolicyRepository(),
      registryReader: createInMemoryModelPolicyRegistryReader([
        makeRegistryReference("mreg_archived", "archived", now),
      ]),
    });

    await expect(
      service.upsertPolicy({
        registryModelId: "mreg_missing",
        actorUserId: "usr_admin",
        patch: { enabled: true },
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });

    await expect(
      service.upsertPolicy({
        registryModelId: "mreg_archived",
        actorUserId: "usr_admin",
        patch: { enabled: true },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("keeps only one default per mode", async () => {
    const service = createModelPolicyService({
      repository: createInMemoryModelPolicyRepository(),
      registryReader: createInMemoryModelPolicyRegistryReader([
        makeRegistryReference("mreg_first"),
        makeRegistryReference("mreg_second"),
      ]),
    });

    await service.upsertPolicy({
      registryModelId: "mreg_first",
      actorUserId: "usr_admin",
      patch: { defaultForChat: true },
    });
    await service.upsertPolicy({
      registryModelId: "mreg_second",
      actorUserId: "usr_admin",
      patch: { defaultForChat: true },
    });

    const defaults = await service.listPolicies({
      defaultsOnly: true,
      page: 1,
      pageSize: 25,
      sort: "priorityRank",
      direction: "asc",
    });

    expect(defaults.total).toBe(1);
    expect(defaults.items[0]?.registryModelId).toBe("mreg_second");
    expect(defaults.items[0]?.defaultForChat).toBe(true);
  });

  it("allows nullable limits and notes to be cleared explicitly", async () => {
    const service = createModelPolicyService({
      repository: createInMemoryModelPolicyRepository(),
      registryReader: createInMemoryModelPolicyRegistryReader([
        makeRegistryReference("mreg_deepseek"),
      ]),
    });

    await service.upsertPolicy({
      registryModelId: "mreg_deepseek",
      actorUserId: "usr_admin",
      patch: {
        requestsPerMinuteLimit: 30,
        tokensPerDayLimit: 50_000,
        tokensPerRequestLimit: 4_000,
        notes: "Temporary launch limits",
      },
    });
    const cleared = await service.upsertPolicy({
      registryModelId: "mreg_deepseek",
      actorUserId: "usr_admin",
      patch: {
        requestsPerMinuteLimit: null,
        tokensPerDayLimit: null,
        tokensPerRequestLimit: null,
        notes: null,
      },
    });

    expect(cleared.requestsPerMinuteLimit).toBeNull();
    expect(cleared.tokensPerDayLimit).toBeNull();
    expect(cleared.tokensPerRequestLimit).toBeNull();
    expect(cleared.notes).toBeNull();
  });

  it("deletes explicit policy rows without touching registry records", async () => {
    const service = createModelPolicyService({
      repository: createInMemoryModelPolicyRepository([
        makePolicyRecord({ registryModelId: "mreg_deepseek" }),
      ]),
      registryReader: createInMemoryModelPolicyRegistryReader([
        makeRegistryReference("mreg_deepseek"),
      ]),
    });

    const deleted = await service.deletePolicy({
      registryModelId: "mreg_deepseek",
      actorUserId: "usr_admin",
    });
    const list = await service.listPolicies({
      defaultsOnly: false,
      page: 1,
      pageSize: 25,
      sort: "priorityRank",
      direction: "asc",
    });

    expect(deleted.registryModelId).toBe("mreg_deepseek");
    expect(list.total).toBe(0);
  });
});

function makeRegistryReference(
  id: string,
  status: "registered" | "archived" = "registered",
  archivedAt: Date | null = null,
) {
  return {
    id,
    status,
    archivedAt,
  };
}

function makePolicyRecord(input: Partial<ModelPolicyRecord> = {}): ModelPolicyRecord {
  return {
    id: "mpol_deepseek",
    registryModelId: "mreg_deepseek",
    enabled: true,
    visibleInSelector: true,
    priorityRank: 100,
    defaultForChat: false,
    defaultForAgent: false,
    requiresCompanion: false,
    requestsPerMinuteLimit: null,
    tokensPerDayLimit: null,
    tokensPerRequestLimit: null,
    notes: null,
    createdByUserId: "usr_admin",
    updatedByUserId: "usr_admin",
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}
