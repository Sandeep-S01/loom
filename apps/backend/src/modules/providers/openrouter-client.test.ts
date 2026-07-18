import { describe, expect, it } from "vitest";
import { invokeOpenRouter, openRouterDriver } from "./openrouter-client.js";
import type { ProviderModelCandidate } from "./types.js";

const candidate: ProviderModelCandidate = {
  providerId: "prv_openrouter",
  providerName: "OpenRouter",
  modelId: "mdl_openrouter",
  modelName: "OpenRouter Test",
  externalModelKey: "openrouter/test",
  providerPriority: 1,
  modelPriority: 1,
  baseType: "openrouter",
  secretRef: "TEST_OPENROUTER_KEY",
};

describe("openrouter client", () => {
  it("returns provider_timeout when the provider call times out", async () => {
    process.env.TEST_OPENROUTER_KEY = "test-key";

    const result = await invokeOpenRouter(candidate, [], {
      fetchFn: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Timed out", "AbortError"));
          });
        }),
      maxAttempts: 1,
      sleep: async () => undefined,
      timeoutMs: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      failureCode: "provider_timeout",
      error: {
        code: "provider_timeout",
        retryable: true,
      },
    });
  });

  it("validates OpenRouter keys with a lightweight provider request and maps invalid keys safely", async () => {
    process.env.TEST_OPENROUTER_KEY = "sk-openrouter-secret";

    const result = await openRouterDriver.testConnection({
      providerModelId: "openrouter/test",
      providerName: "OpenRouter",
      secretRef: "TEST_OPENROUTER_KEY",
      controls: {
        fetchFn: async () => new Response("raw provider secret sk-openrouter-secret", {
          status: 401,
        }),
        maxAttempts: 1,
        sleep: async () => undefined,
        timeoutMs: 10,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      failureCode: "invalid_api_key",
      status: "invalid_key",
    });
    expect(JSON.stringify(result)).not.toContain("sk-openrouter-secret");
  });
});
