import { describe, expect, it } from "vitest";
import { geminiDriver, invokeGemini } from "./gemini-client.js";
import type { ProviderModelCandidate } from "./types.js";

const candidate: ProviderModelCandidate = {
  providerId: "prv_gemini",
  providerName: "Google Gemini",
  modelId: "mdl_gemini",
  modelName: "Gemini Test",
  externalModelKey: "gemini-test",
  providerPriority: 1,
  modelPriority: 1,
  baseType: "gemini",
  secretRef: "TEST_GEMINI_KEY",
};

describe("gemini client", () => {
  it("returns provider_timeout when the provider call times out", async () => {
    process.env.TEST_GEMINI_KEY = "test-key";

    const result = await invokeGemini(candidate, [], {
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

  it("maps Gemini validation timeout to a safe degraded status", async () => {
    process.env.TEST_GEMINI_KEY = "gemini-secret-value";

    const result = await geminiDriver.testConnection({
      providerModelId: "gemini-test",
      providerName: "Google Gemini",
      secretRef: "TEST_GEMINI_KEY",
      controls: {
        fetchFn: async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Timed out", "AbortError"));
            });
          }),
        maxAttempts: 1,
        sleep: async () => undefined,
        timeoutMs: 1,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      failureCode: "provider_timeout",
      status: "degraded",
    });
    expect(JSON.stringify(result)).not.toContain("gemini-secret-value");
  });
});
