import { describe, expect, it } from "vitest";
import { createInMemoryModelUsageRepository } from "./repository.js";
import { createModelUsageService } from "./service.js";

describe("model usage service", () => {
  it("records usage into hourly and daily counters", async () => {
    const service = createModelUsageService({
      repository: createInMemoryModelUsageRepository(),
    });

    const result = await service.recordUsage({
      registryModelId: "mreg_1",
      providerId: "prov_1",
      mode: "chat",
      status: "success",
      usedFallback: true,
      failureCode: null,
      latencyMs: 250,
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
      costUsdMicros: 0,
      occurredAt: new Date("2026-07-19T14:21:30.000Z"),
    });

    expect(result.counters).toHaveLength(2);
    expect(result.counters.map((counter) => counter.bucketGranularity).sort()).toEqual([
      "day",
      "hour",
    ]);
    expect(result.counters.find((counter) => counter.bucketGranularity === "hour"))
      .toMatchObject({
        bucketStart: new Date("2026-07-19T14:00:00.000Z"),
        requestCount: 1,
        successCount: 1,
        fallbackCount: 1,
        inputTokens: 100,
        outputTokens: 40,
        totalTokens: 140,
        latencySampleCount: 1,
      });
  });

  it("aggregates repeated usage and exposes summaries from hourly counters only", async () => {
    const service = createModelUsageService({
      repository: createInMemoryModelUsageRepository(),
    });

    await service.recordUsage(makeUsage({ status: "success", totalTokens: 30 }));
    await service.recordUsage(
      makeUsage({
        status: "failed",
        failureCode: "provider_rate_limited",
        usedFallback: true,
        latencyMs: 300,
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
      }),
    );

    const summary = await service.getSummary({});

    expect(summary).toMatchObject({
      requestCount: 2,
      successCount: 1,
      failureCount: 1,
      fallbackCount: 1,
      rateLimitCount: 1,
      inputTokens: 40,
      outputTokens: 20,
      totalTokens: 60,
      latencySampleCount: 2,
      averageLatencyMs: 250,
    });
  });

  it("does not count missing latency values in average latency", async () => {
    const service = createModelUsageService({
      repository: createInMemoryModelUsageRepository(),
    });

    await service.recordUsage(makeUsage({ latencyMs: null }));
    await service.recordUsage(makeUsage({ latencyMs: 300 }));

    const summary = await service.getSummary({});

    expect(summary).toMatchObject({
      requestCount: 2,
      latencyMsTotal: 300,
      latencySampleCount: 1,
      averageLatencyMs: 300,
    });
  });

  it("lists counters with filters and computed average latency", async () => {
    const service = createModelUsageService({
      repository: createInMemoryModelUsageRepository(),
    });
    await service.recordUsage(makeUsage({ registryModelId: "mreg_a" }));
    await service.recordUsage(makeUsage({ registryModelId: "mreg_b" }));

    const result = await service.listCounters({
      registryModelId: "mreg_a",
      granularity: "hour",
      page: 1,
      pageSize: 10,
      sort: "bucketStart",
      direction: "desc",
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      registryModelId: "mreg_a",
      bucketGranularity: "hour",
      latencySampleCount: 1,
      averageLatencyMs: 200,
    });
  });

  it("rejects inconsistent token totals", async () => {
    const service = createModelUsageService({
      repository: createInMemoryModelUsageRepository(),
    });

    await expect(
      service.recordUsage(makeUsage({ inputTokens: 10, outputTokens: 5, totalTokens: 20 })),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
    });
  });
});

function makeUsage(input: {
  registryModelId?: string;
  providerId?: string;
  status?: "success" | "failed" | "blocked";
  usedFallback?: boolean;
  failureCode?: string | null;
  latencyMs?: number | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
} = {}) {
  return {
    registryModelId: input.registryModelId ?? "mreg_1",
    providerId: input.providerId ?? "prov_1",
    mode: "chat" as const,
    status: input.status ?? "success",
    usedFallback: input.usedFallback ?? false,
    failureCode: input.failureCode ?? null,
    latencyMs: "latencyMs" in input ? input.latencyMs : 200,
    inputTokens: input.inputTokens ?? 20,
    outputTokens: input.outputTokens ?? 10,
    totalTokens: input.totalTokens ?? 30,
    costUsdMicros: 0,
    occurredAt: new Date("2026-07-19T14:21:30.000Z"),
  };
}
