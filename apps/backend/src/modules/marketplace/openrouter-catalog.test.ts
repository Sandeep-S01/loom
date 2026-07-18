import { describe, expect, it } from "vitest";
import { normalizeOpenRouterFreeModels } from "./openrouter-catalog.js";

describe("OpenRouter free catalog normalization", () => {
  it("imports explicit :free models", () => {
    const models = normalizeOpenRouterFreeModels({
      data: [
        {
          id: "qwen/qwen3-coder:free",
          name: "Qwen: Qwen3 Coder (free)",
          context_length: 1048576,
          pricing: { prompt: "0", completion: "0" },
          architecture: {
            input_modalities: ["text"],
            output_modalities: ["text"],
          },
        },
      ],
    });

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      providerModelId: "qwen/qwen3-coder:free",
      owner: "qwen",
      supportsChat: true,
      supportsVision: false,
      contextWindow: 1048576,
    });
  });

  it("does not import paid models with misleading names", () => {
    const models = normalizeOpenRouterFreeModels({
      data: [
        {
          id: "qwen/qwen3-30b-a3b",
          name: "Qwen3 30B A3B",
          pricing: { prompt: "0.00000012", completion: "0.0000005" },
          architecture: {
            input_modalities: ["text"],
            output_modalities: ["text"],
          },
        },
      ],
    });

    expect(models).toEqual([]);
  });

  it("marks image-capable free models as vision-capable", () => {
    const models = normalizeOpenRouterFreeModels({
      data: [
        {
          id: "example/vision-model:free",
          pricing: { prompt: "0", completion: "0" },
          architecture: {
            input_modalities: ["text", "image"],
            output_modalities: ["text"],
          },
        },
      ],
    });

    expect(models[0]?.supportsVision).toBe(true);
  });
});
