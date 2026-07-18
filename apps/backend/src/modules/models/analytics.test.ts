import { describe, expect, it } from "vitest";
import { createInMemoryModelAnalyticsService } from "./analytics.js";

describe("model analytics service", () => {
  it("aggregates model usage into summaries and time-series buckets", async () => {
    const service = createInMemoryModelAnalyticsService();

    await service.recordAttempt({
      conversationId: "con_1",
      messageId: "msg_1",
      providerId: "prv_openrouter",
      modelId: "mdl_qwen",
      attemptNo: 1,
      wasManualSelection: true,
      wasFailover: false,
      requestKind: "chat",
      status: "success",
      latencyMs: 420,
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
      costUsdMicros: 1500,
      idempotencyKey: "route_1",
      createdAt: "2026-07-07T09:00:00.000Z",
    });

    await service.recordAttempt({
      conversationId: "con_2",
      messageId: "msg_2",
      providerId: "prv_openrouter",
      modelId: "mdl_qwen",
      attemptNo: 1,
      wasManualSelection: false,
      wasFailover: true,
      requestKind: "chat",
      status: "failed",
      failureCode: "quota_exhausted",
      latencyMs: 300,
      inputTokens: 100,
      outputTokens: 0,
      totalTokens: 100,
      costUsdMicros: 500,
      idempotencyKey: "route_2",
      createdAt: "2026-07-07T09:10:00.000Z",
    });

    const analytics = await service.getAnalytics({
      from: "2026-07-07T00:00:00.000Z",
      to: "2026-07-08T00:00:00.000Z",
      granularity: "hour",
    });

    expect(analytics.summary).toEqual([
      expect.objectContaining({
        modelId: "mdl_qwen",
        requestCount: 2,
        successCount: 1,
        errorCount: 1,
        rateLimitCount: 1,
        totalTokens: 300,
        costUsdMicros: 2000,
      }),
    ]);
    expect(analytics.series).toEqual([
      expect.objectContaining({
        modelId: "mdl_qwen",
        bucketStart: "2026-07-07T09:00:00.000Z",
        requestCount: 2,
      }),
    ]);
  });
});
