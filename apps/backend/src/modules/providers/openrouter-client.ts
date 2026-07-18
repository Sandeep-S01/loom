import type { ProviderPromptMessage } from "../chat/prompt-assembly.js";
import type { ProviderInvocationResult, ProviderModelCandidate } from "./types.js";
import {
  buildModelIdentityInstruction,
  estimateUsageFromHistory,
  resolveSecretFromRef,
  type DriverTestConnectionResult,
  type ProviderDriver,
} from "./driver-registry.js";
import {
  callProviderWithControls,
  normalizeProviderFailure,
  type ProviderCallControls,
} from "./provider-call.js";

export async function invokeOpenRouter(
  candidate: ProviderModelCandidate,
  prompt: ProviderPromptMessage[],
  controls: ProviderCallControls = {},
): Promise<ProviderInvocationResult> {
  const apiKey = resolveSecretFromRef(candidate.secretRef ?? "OPENROUTER_API_KEY");

  const providerCall = await callProviderWithControls({
    ...controls,
    modelId: candidate.modelId,
    providerName: candidate.providerName,
    url: "https://openrouter.ai/api/v1/chat/completions",
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: candidate.externalModelKey,
        max_tokens: 512,
        messages: toOpenRouterMessages(prompt, candidate),
      }),
    },
  });

  if (!providerCall.ok) {
    return {
      ok: false,
      failureCode: providerCall.failureCode,
      error: providerCall.error,
      retryAfterSeconds: providerCall.retryAfterSeconds,
      attempts: providerCall.attempts,
      latencyMs: providerCall.latencyMs,
    };
  }

  try {
    const response = providerCall.response;

    const body = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      const error = normalizeProviderFailure({
        failureCode: "unknown_provider_error",
        modelId: candidate.modelId,
        providerName: candidate.providerName,
      });
      return {
        ok: false,
        failureCode: "unknown_provider_error",
        error,
        attempts: providerCall.attempts,
        latencyMs: providerCall.latencyMs,
      };
    }

    const promptTexts = prompt.map((message) =>
      message.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n"),
    );

    return {
      ok: true,
      text,
      usage: estimateUsageFromHistory(promptTexts, text),
    };
  } catch {
    const error = normalizeProviderFailure({
      failureCode: "unknown_provider_error",
      modelId: candidate.modelId,
      providerName: candidate.providerName,
    });
    return {
      ok: false,
      failureCode: "unknown_provider_error",
      error,
      attempts: providerCall.attempts,
      latencyMs: providerCall.latencyMs,
    };
  }
}

export const openRouterDriver: ProviderDriver = {
  key: "openrouter",
  async testConnection(input) {
    const checkedAt = new Date().toISOString();
    let apiKey: string;
    try {
      apiKey = resolveSecretFromRef(input.secretRef ?? "OPENROUTER_API_KEY");
    } catch {
      return {
        ok: false,
        status: "missing_key",
        failureCode: "provider_unavailable",
        checkedAt,
        message: "OpenRouter API key is not configured.",
      };
    }

    const providerCall = await callProviderWithControls({
      ...(input.controls ?? {}),
      modelId: input.providerModelId,
      providerName: input.providerName ?? "OpenRouter",
      url: "https://openrouter.ai/api/v1/models",
      init: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    });

    return toConnectionResult(providerCall, checkedAt);
  },
  async invokeChat(input) {
    return invokeOpenRouter(
      {
        providerId: "prv_openrouter",
        providerName: input.providerName,
        modelId: input.providerModelId,
        modelName: input.modelName,
        externalModelKey: input.providerModelId,
        providerPriority: 1,
        modelPriority: 1,
        baseType: "openrouter",
        secretRef: input.secretRef,
      },
      input.prompt,
      { timeoutMs: input.timeoutMs },
    );
  },
};

function toOpenRouterMessages(
  prompt: ProviderPromptMessage[],
  candidate: ProviderModelCandidate,
) {
  const hasSystem = prompt.some((message) => message.role === "system");
  const messages = hasSystem
    ? prompt
    : [
        {
          role: "system" as const,
          content: [
            {
              type: "text" as const,
              text: buildModelIdentityInstruction({
                modelName: candidate.modelName,
                providerName: candidate.providerName,
              }),
            },
          ],
        },
        ...prompt,
      ];

  return messages.map((message) => ({
    role: message.role === "assistant"
      ? "assistant"
      : message.role === "system" || message.role === "developer"
        ? "system"
        : "user",
    content: message.content.length === 1 && message.content[0]?.type === "text"
      ? message.content[0].text
      : message.content.map((item) =>
          item.type === "text"
            ? {
                type: "text",
                text: item.text,
              }
            : {
                type: "image_url",
                image_url: {
                  url: `data:${item.mimeType};base64,${item.data}`,
                },
              },
        ),
  }));
}

function toConnectionResult(
  providerCall: Awaited<ReturnType<typeof callProviderWithControls>>,
  checkedAt: string,
): DriverTestConnectionResult {
  if (providerCall.ok) {
    return {
      ok: true,
      status: "connected",
      checkedAt,
    };
  }

  return {
    ok: false,
    status: providerCall.error.code === "invalid_api_key"
      ? "invalid_key"
      : providerCall.error.retryable
        ? "degraded"
        : "unavailable",
    failureCode: providerCall.failureCode,
    checkedAt,
    message: providerCall.error.message,
  };
}
