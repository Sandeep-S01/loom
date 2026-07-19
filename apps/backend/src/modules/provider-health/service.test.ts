import { describe, expect, it, vi } from "vitest";
import type { ProviderHealthRecord } from "./domain.js";
import {
  createInMemoryProviderHealthProviderReader,
  createInMemoryProviderHealthRepository,
} from "./repository.js";
import { createProviderHealthService } from "./service.js";

const now = new Date("2026-07-19T00:00:00.000Z");

describe("provider health service", () => {
  it("upserts provider-level health without credentials, eligibility, or routing fields", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const service = createProviderHealthService({
      repository: createInMemoryProviderHealthRepository(),
      providerReader: createInMemoryProviderHealthProviderReader([
        { id: "prv_openrouter" },
      ]),
      logger,
    });

    const result = await service.upsertProviderHealth({
      providerId: "prv_openrouter",
      actorUserId: "usr_admin",
      patch: {
        status: "unavailable",
        cooldownUntil: new Date("2026-07-19T01:00:00.000Z"),
        consecutiveFailures: 4,
        lastFailureCode: "provider_5xx",
        reason: "Provider API returned repeated 500s",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        providerId: "prv_openrouter",
        status: "unavailable",
        consecutiveFailures: 4,
      }),
    );
    expect(result).not.toHaveProperty("secretRef");
    expect(result).not.toHaveProperty("eligible");
    expect(result).not.toHaveProperty("routingScore");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "provider_health.state_upserted",
        providerId: "prv_openrouter",
      }),
      "Provider health state upserted",
    );
  });

  it("rejects missing providers before writing state", async () => {
    const service = createProviderHealthService({
      repository: createInMemoryProviderHealthRepository(),
      providerReader: createInMemoryProviderHealthProviderReader(),
    });

    await expect(
      service.upsertProviderHealth({
        providerId: "prv_missing",
        actorUserId: "usr_admin",
        patch: { status: "healthy" },
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("resets provider health to healthy", async () => {
    const service = createProviderHealthService({
      repository: createInMemoryProviderHealthRepository([
        makeProviderHealthRecord({
          providerId: "prv_openrouter",
          status: "auth_invalid",
          cooldownUntil: new Date("2026-07-19T01:00:00.000Z"),
          consecutiveFailures: 8,
          lastFailureCode: "auth_invalid",
        }),
      ]),
      providerReader: createInMemoryProviderHealthProviderReader([
        { id: "prv_openrouter" },
      ]),
    });

    const result = await service.resetProviderHealth({
      providerId: "prv_openrouter",
      actorUserId: "usr_admin",
    });

    expect(result.status).toBe("healthy");
    expect(result.cooldownUntil).toBeNull();
    expect(result.consecutiveFailures).toBe(0);
    expect(result.lastFailureCode).toBeNull();
    expect(result.lastSuccessAt).not.toBeNull();
  });

  it("returns provider snapshots for eligibility without creating rows", async () => {
    const service = createProviderHealthService({
      repository: createInMemoryProviderHealthRepository([
        makeProviderHealthRecord({
          providerId: "prv_openrouter",
          status: "degraded",
          reason: "slow responses",
        }),
      ]),
      providerReader: createInMemoryProviderHealthProviderReader(),
    });

    const snapshots = await service.getProviderHealth([
      "prv_openrouter",
      "prv_missing_state",
    ]);

    expect(snapshots.get("prv_openrouter")).toEqual(
      expect.objectContaining({
        providerId: "prv_openrouter",
        status: "degraded",
        reason: "slow responses",
      }),
    );
    expect(snapshots.get("prv_missing_state")).toEqual({
      providerId: "prv_missing_state",
      status: "unknown",
      cooldownUntil: null,
      checkedAt: null,
      reason: null,
    });
  });
});

function makeProviderHealthRecord(
  input: Partial<ProviderHealthRecord> = {},
): ProviderHealthRecord {
  return {
    id: "phs_openrouter",
    providerId: "prv_openrouter",
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
