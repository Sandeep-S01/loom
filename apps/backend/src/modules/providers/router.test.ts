import { describe, expect, it } from "vitest";
import { selectNextModel } from "./router.js";

describe("provider router", () => {
  it("skips the failed first choice and selects the next eligible chat model", () => {
    const selected = selectNextModel(
      [
        {
          providerId: "prv_openrouter",
          modelId: "mdl_deepseek_chat_free",
          modelName: "DeepSeek Chat (Free)",
          providerPriority: 1,
          modelPriority: 1,
        },
        {
          providerId: "prv_openrouter",
          modelId: "mdl_qwen3_30b_free",
          modelName: "Qwen3 30B A3B (Free)",
          providerPriority: 1,
          modelPriority: 2,
        },
      ],
      new Set(["mdl_deepseek_chat_free"]),
    );

    expect(selected?.modelId).toBe("mdl_qwen3_30b_free");
  });
});
