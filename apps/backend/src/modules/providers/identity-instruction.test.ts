import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeGemini } from "./gemini-client.js";
import { invokeOpenRouter } from "./openrouter-client.js";

describe("provider identity instructions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("sends the selected model identity to OpenRouter requests", async () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Qwen reply",
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await invokeOpenRouter(
      {
        providerId: "prv_openrouter",
        providerName: "OpenRouter",
        modelId: "mdl_qwen3_30b_free",
        modelName: "Qwen3 30B A3B (Free)",
        externalModelKey: "qwen/qwen3-30b-a3b",
        providerPriority: 1,
        modelPriority: 1,
        baseType: "openrouter",
        secretRef: "OPENROUTER_API_KEY",
      },
      [
        {
          role: "user",
          content: [{ type: "text", text: "Which model are you?" }],
        },
      ],
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      messages?: Array<{ role?: string; content?: string }>;
    };

    expect(body.messages?.[0]).toMatchObject({
      role: "system",
    });
    expect(body.messages?.[0]?.content).toContain("Qwen3 30B A3B (Free)");
    expect(body.messages?.[0]?.content).toContain("OpenRouter");
  });

  it("sends the selected model identity to Gemini requests", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Gemini reply" }],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await invokeGemini(
      {
        providerId: "prv_gemini",
        providerName: "Google Gemini",
        modelId: "mdl_gemini_2_flash",
        modelName: "Gemini 2.0 Flash",
        externalModelKey: "gemini-2.0-flash",
        providerPriority: 1,
        modelPriority: 1,
        baseType: "gemini",
        secretRef: "GEMINI_API_KEY",
      },
      [
        {
          role: "user",
          content: [{ type: "text", text: "Which model are you?" }],
        },
      ],
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = JSON.parse(String(requestInit?.body ?? "{}")) as {
      system_instruction?: {
        parts?: Array<{ text?: string }>;
      };
    };

    expect(body.system_instruction?.parts?.[0]?.text).toContain("Gemini 2.0 Flash");
    expect(body.system_instruction?.parts?.[0]?.text).toContain("Google Gemini");
  });
});
