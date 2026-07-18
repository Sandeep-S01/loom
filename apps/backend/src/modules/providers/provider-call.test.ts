import { describe, expect, it } from "vitest";
import {
  callProviderWithControls,
  normalizeProviderFailure,
} from "./provider-call.js";

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

function errorResponse(status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify({ error: "provider failed" }), {
    status,
    headers,
  });
}

describe("provider call controls", () => {
  it("retries retryable provider_5xx failures", async () => {
    let calls = 0;

    const result = await callProviderWithControls({
      fetchFn: async () => {
        calls += 1;
        return calls === 1 ? errorResponse(502) : okResponse();
      },
      init: { method: "POST" },
      maxAttempts: 2,
      modelId: "mdl_test",
      providerName: "Test Provider",
      sleep: async () => undefined,
      timeoutMs: 1000,
      url: "https://provider.test/chat",
    });

    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("does not retry non-retryable invalid_api_key failures", async () => {
    let calls = 0;

    const result = await callProviderWithControls({
      fetchFn: async () => {
        calls += 1;
        return errorResponse(401);
      },
      init: { method: "POST" },
      maxAttempts: 3,
      modelId: "mdl_test",
      providerName: "Test Provider",
      sleep: async () => undefined,
      timeoutMs: 1000,
      url: "https://provider.test/chat",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected provider call to fail");
    expect(result.error.code).toBe("invalid_api_key");
    expect(result.error.retryable).toBe(false);
    expect(calls).toBe(1);
  });

  it("switches immediately instead of retrying a rate-limited provider", async () => {
    const sleeps: number[] = [];
    let calls = 0;

    const result = await callProviderWithControls({
      fetchFn: async () => {
        calls += 1;
        return errorResponse(429, { "retry-after": "2" });
      },
      init: { method: "POST" },
      jitterMs: () => 0,
      maxAttempts: 2,
      modelId: "mdl_test",
      providerName: "Test Provider",
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      timeoutMs: 1000,
      url: "https://provider.test/chat",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected provider call to fail");
    expect(result.retryAfterSeconds).toBe(2);
    expect(calls).toBe(1);
    expect(sleeps).toEqual([]);
  });

  it("caps retry delays reported by unavailable providers", async () => {
    const sleeps: number[] = [];
    let calls = 0;

    const result = await callProviderWithControls({
      fetchFn: async () => {
        calls += 1;
        return calls === 1
          ? errorResponse(503, { "retry-after": "60" })
          : okResponse();
      },
      init: { method: "POST" },
      jitterMs: () => 0,
      maxAttempts: 2,
      maxRetryDelayMs: 1000,
      modelId: "mdl_test",
      providerName: "Test Provider",
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      timeoutMs: 1000,
      url: "https://provider.test/chat",
    });

    expect(result.ok).toBe(true);
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeGreaterThan(0);
    expect(sleeps[0]).toBeLessThanOrEqual(1000);
  });

  it("uses timeoutMs as a total retry budget", async () => {
    let calls = 0;

    const result = await callProviderWithControls({
      fetchFn: async () => {
        calls += 1;
        return errorResponse(503);
      },
      init: { method: "POST" },
      maxAttempts: 3,
      maxRetryDelayMs: 10,
      modelId: "mdl_test",
      providerName: "Test Provider",
      sleep: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      },
      timeoutMs: 5,
      url: "https://provider.test/chat",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected provider call to fail");
    expect(result.error.code).toBe("provider_timeout");
    expect(calls).toBe(1);
  });

  it("normalizes aborted provider calls as provider_timeout", async () => {
    const result = await callProviderWithControls({
      fetchFn: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Timed out", "AbortError"));
          });
        }),
      init: { method: "POST" },
      maxAttempts: 1,
      modelId: "mdl_test",
      providerName: "Test Provider",
      sleep: async () => undefined,
      timeoutMs: 1,
      url: "https://provider.test/chat",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected provider call to fail");
    expect(result.error).toMatchObject({
      code: "provider_timeout",
      retryable: true,
      modelId: "mdl_test",
      providerName: "Test Provider",
    });
  });

  it("maps legacy failure codes into the normalized taxonomy", () => {
    expect(normalizeProviderFailure({ failureCode: "auth_invalid" }).code).toBe(
      "invalid_api_key",
    );
    expect(
      normalizeProviderFailure({ failureCode: "rate_limited_transient" }).code,
    ).toBe("provider_rate_limited");
  });
});
