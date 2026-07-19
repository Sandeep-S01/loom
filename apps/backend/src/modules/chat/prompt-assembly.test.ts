import { describe, expect, it } from "vitest";
import type { MessageRecord } from "../conversations/repository.js";
import {
  assemblePrompt,
  isContextPathSafe,
  type ChatContextBlockInput,
} from "./prompt-assembly.js";

function message(
  id: string,
  role: MessageRecord["role"],
  text: string,
): MessageRecord {
  return {
    id,
    conversationId: "con_test",
    role,
    content: [{ type: "text", text }],
    providerId: null,
    modelId: null,
    registryModelId: null,
    createdAt: "2026-07-08T00:00:00.000Z",
  };
}

describe("prompt assembly", () => {
  it("assembles deterministic system, developer, history, context, and user messages", () => {
    const contextBlocks: ChatContextBlockInput[] = [
      {
        sourceType: "manual",
        content: "Use the billing workspace conventions.",
        priority: 2,
      },
      {
        sourceType: "selected_file",
        path: "src/api/billing.ts",
        language: "ts",
        content: "export function charge() { return true; }",
        priority: 1,
      },
    ];

    const first = assemblePrompt({
      modelName: "Qwen 3",
      providerName: "OpenRouter",
      currentUserContent: [{ type: "text", text: "Review this change" }],
      history: [
        message("msg_1", "user", "Earlier question"),
        message("msg_2", "assistant", "Earlier answer"),
      ],
      contextBlocks,
      budget: {
        contextWindowTokens: 500,
        reservedResponseTokens: 100,
        maxWorkspaceContextTokens: 160,
        maxTokensPerContextBlock: 80,
        maxContextBlocks: 4,
        maxUserMessageTokens: 120,
      },
    });
    const second = assemblePrompt({
      modelName: "Qwen 3",
      providerName: "OpenRouter",
      currentUserContent: [{ type: "text", text: "Review this change" }],
      history: [
        message("msg_1", "user", "Earlier question"),
        message("msg_2", "assistant", "Earlier answer"),
      ],
      contextBlocks,
      budget: {
        contextWindowTokens: 500,
        reservedResponseTokens: 100,
        maxWorkspaceContextTokens: 160,
        maxTokensPerContextBlock: 80,
        maxContextBlocks: 4,
        maxUserMessageTokens: 120,
      },
    });

    expect(second).toEqual(first);
    expect(first.messages.map((item) => item.role)).toEqual([
      "system",
      "developer",
      "user",
      "assistant",
      "user",
      "user",
      "user",
    ]);
    expect(first.messages[4]?.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("src/api/billing.ts"),
    });
    expect(first.metadata.includedContextCount).toBe(2);
    expect(first.metadata.excludedContextCount).toBe(0);
  });

  it("excludes sensitive, generated, binary, traversal, and oversized context blocks", () => {
    const result = assemblePrompt({
      modelName: "Gemini",
      providerName: "Google Gemini",
      currentUserContent: [{ type: "text", text: "Summarize safe context" }],
      history: [],
      contextBlocks: [
        { sourceType: "selected_file", path: ".env", content: "OPENROUTER_API_KEY=secret", priority: 1 },
        { sourceType: "selected_file", path: "keys/id_rsa", content: "PRIVATE KEY", priority: 2 },
        { sourceType: "selected_file", path: "node_modules/pkg/index.js", content: "module", priority: 3 },
        { sourceType: "selected_file", path: "../outside.ts", content: "escape", priority: 4 },
        { sourceType: "selected_file", path: "src/image.png", content: "\u0000PNG", priority: 5 },
        { sourceType: "selected_file", path: "src/large.ts", content: "x".repeat(120), sizeBytes: 120, priority: 6 },
        { sourceType: "selected_file", path: "src/safe.ts", content: "export const safe = true;", sizeBytes: 25, priority: 7 },
      ],
      maxFileSizeBytes: 64,
      budget: {
        contextWindowTokens: 500,
        reservedResponseTokens: 100,
        maxWorkspaceContextTokens: 120,
        maxTokensPerContextBlock: 80,
        maxContextBlocks: 8,
        maxUserMessageTokens: 120,
      },
    });
    const serialized = JSON.stringify(result);

    expect(result.metadata.includedContextCount).toBe(1);
    expect(result.metadata.excludedContextCount).toBe(6);
    expect(serialized).not.toContain("OPENROUTER_API_KEY=secret");
    expect(serialized).not.toContain("PRIVATE KEY");
    expect(serialized).toContain("src/safe.ts");
  });

  it("trims workspace context to fit the configured token budget", () => {
    const result = assemblePrompt({
      modelName: "Qwen 3",
      providerName: "OpenRouter",
      currentUserContent: [{ type: "text", text: "Use what fits" }],
      history: [],
      contextBlocks: [
        { sourceType: "selected_file", path: "src/first.ts", content: "a ".repeat(80), priority: 1 },
        { sourceType: "manual", content: "b ".repeat(80), priority: 2 },
      ],
      budget: {
        contextWindowTokens: 180,
        reservedResponseTokens: 80,
        maxWorkspaceContextTokens: 40,
        maxTokensPerContextBlock: 20,
        maxContextBlocks: 4,
        maxUserMessageTokens: 120,
      },
    });

    expect(result.metadata.truncatedContext).toBe(true);
    expect(result.metadata.includedContextCount).toBe(2);
    expect(result.metadata.estimatedPromptTokens).toBeLessThanOrEqual(100);
  });

  it("rejects a current user message that cannot fit by itself", () => {
    try {
      assemblePrompt({
        modelName: "Small",
        providerName: "Test",
        currentUserContent: [{ type: "text", text: "x ".repeat(200) }],
        history: [],
        contextBlocks: [],
        budget: {
          contextWindowTokens: 180,
          reservedResponseTokens: 80,
          maxWorkspaceContextTokens: 40,
          maxTokensPerContextBlock: 20,
          maxContextBlocks: 4,
          maxUserMessageTokens: 20,
        },
      });
      throw new Error("Expected prompt assembly to reject the large user message");
    } catch (error) {
      expect(error).toMatchObject({
        code: "context_too_large",
      });
    }
  });

  it("rejects unsafe paths deterministically", () => {
    expect(isContextPathSafe("src/index.ts")).toBe(true);
    expect(isContextPathSafe("../.env")).toBe(false);
    expect(isContextPathSafe("C:/Users/Sandeep/.env")).toBe(false);
    expect(isContextPathSafe("src/../.env")).toBe(false);
  });
});
