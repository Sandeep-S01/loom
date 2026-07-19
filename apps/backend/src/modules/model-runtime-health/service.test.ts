import { describe, expect, it, vi } from "vitest";
import type { ModelRuntimeHealthRecord } from "./domain.js";
import {
  createInMemoryModelRuntimeHealthRegistryReader,
  createInMemoryModelRuntimeHealthRepository,
} from "./repository.js";
import { createModelRuntimeHealthService } from "./service.js";

const now = new Date("2026-07-19T00:00:00.000Z");

describe("model runtime health service", () => {
  it("upserts model-level runtime state without eligibility or routing fields", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = createModelRuntimeHealthService({
      repository: createInMemoryModelRuntimeHealthRepository(),
      registryReader: createInMemoryModelRuntimeHealthRegistryReader([
        makeRegistryReference("mreg_deepseek"),
      ]),
      logger,
    });

    const result = await service.upsertRuntimeHealth({
      registryModelId: "mreg_deepseek",
      actorUserId: "usr_admin",
      patch: {
        status: "rate_limited",
        cooldownUntil: new Date("2026-07-19T01:00:00.000Z"),
        consecutiveFailures: 3,
        lastFailureCode: "rate_limit",
        reason: "Provider returned 429",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        registryModelId: "mreg_deepseek",
        status: "rate_limited",
        consecutiveFailures: 3,
      }),
    );
    expect(result).not.toHaveProperty("eligible");
    expect(result).not.toHaveProperty("routingScore");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "model_runtime_health.state_upserted",
        registryModelId: "mreg_deepseek",
      }),
      "Model runtime health state upserted",
    );
  });

  it("rejects missing or archived registry models", async () => {
    const service = createModelRuntimeHealthService({
      repository: createInMemoryModelRuntimeHealthRepository(),
      registryReader: createInMemoryModelRuntimeHealthRegistryReader([
        makeRegistryReference("mreg_archived", "archived", now),
      ]),
    });

    await expect(
      service.upsertRuntimeHealth({
        registryModelId: "mreg_missing",
        actorUserId: "usr_admin",
        patch: { status: "healthy" },
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });

    await expect(
      service.resetRuntimeHealth({
        registryModelId: "mreg_archived",
        actorUserId: "usr_admin",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  it("resets runtime state to healthy", async () => {
    const service = createModelRuntimeHealthService({
      repository: createInMemoryModelRuntimeHealthRepository([
        makeRuntimeRecord({
          registryModelId: "mreg_deepseek",
          status: "open_circuit",
          cooldownUntil: new Date("2026-07-19T01:00:00.000Z"),
          consecutiveFailures: 7,
          lastFailureCode: "timeout",
        }),
      ]),
      registryReader: createInMemoryModelRuntimeHealthRegistryReader([
        makeRegistryReference("mreg_deepseek"),
      ]),
    });

    const result = await service.resetRuntimeHealth({
      registryModelId: "mreg_deepseek",
      actorUserId: "usr_admin",
    });

    expect(result.status).toBe("healthy");
    expect(result.cooldownUntil).toBeNull();
    expect(result.consecutiveFailures).toBe(0);
    expect(result.lastFailureCode).toBeNull();
    expect(result.lastSuccessAt).not.toBeNull();
  });

  it("returns snapshots for eligibility without creating rows", async () => {
    const service = createModelRuntimeHealthService({
      repository: createInMemoryModelRuntimeHealthRepository([
        makeRuntimeRecord({
          registryModelId: "mreg_deepseek",
          status: "degraded",
          reason: "slow responses",
        }),
      ]),
      registryReader: createInMemoryModelRuntimeHealthRegistryReader(),
    });

    const snapshots = await service.getRuntimeHealth([
      "mreg_deepseek",
      "mreg_missing_state",
    ]);

    expect(snapshots.get("mreg_deepseek")).toEqual(
      expect.objectContaining({
        registryModelId: "mreg_deepseek",
        status: "degraded",
        reason: "slow responses",
      }),
    );
    expect(snapshots.get("mreg_missing_state")).toEqual({
      registryModelId: "mreg_missing_state",
      status: "unknown",
      cooldownUntil: null,
      checkedAt: null,
      reason: null,
    });
  });
});

function makeRegistryReference(
  id: string,
  status: "registered" | "archived" = "registered",
  archivedAt: Date | null = null,
) {
  return { id, status, archivedAt };
}

function makeRuntimeRecord(
  input: Partial<ModelRuntimeHealthRecord> = {},
): ModelRuntimeHealthRecord {
  return {
    id: "mrts_deepseek",
    registryModelId: "mreg_deepseek",
    status: "healthy",
    cooldownUntil: null,
    consecutiveFailures: 0,
    lastFailureCode: null,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastCheckedAt: now,
    reason: null,
    updatedByUserId: "usr_admin",
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}
