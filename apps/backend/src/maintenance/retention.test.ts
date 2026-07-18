import { describe, expect, it, vi } from "vitest";
import { createRetentionCleanupService, normalizeRetentionPolicy } from "./retention.js";

describe("retention cleanup", () => {
  it("normalizes unsafe policy values", () => {
    expect(normalizeRetentionPolicy({
      modelUsageDays: 0,
      providerAttemptDays: Number.NaN,
      auditDays: 99_999,
      expiredSessionGraceDays: -1,
      expiredIdempotencyGraceDays: 7,
      batchSize: 50_000,
    })).toEqual({
      modelUsageDays: 1,
      providerAttemptDays: 1,
      auditDays: 3650,
      expiredSessionGraceDays: 0,
      expiredIdempotencyGraceDays: 7,
      batchSize: 10_000,
    });
  });

  it("deletes one bounded batch for every retained raw-data target", async () => {
    const deleteBatch = vi.fn(async () => 2);
    const service = createRetentionCleanupService({
      policy: {
        modelUsageDays: 30,
        providerAttemptDays: 30,
        auditDays: 90,
        expiredSessionGraceDays: 7,
        expiredIdempotencyGraceDays: 1,
        batchSize: 500,
      },
      deleteBatch,
    });

    const result = await service.run(new Date("2026-07-11T00:00:00.000Z"));

    expect(deleteBatch).toHaveBeenCalledTimes(5);
    expect(deleteBatch).toHaveBeenCalledWith(
      "model_usage_events",
      new Date("2026-06-11T00:00:00.000Z"),
      500,
    );
    expect(result.totalDeleted).toBe(10);
  });
});
