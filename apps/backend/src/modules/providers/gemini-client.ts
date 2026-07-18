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

export async function invokeGemini(
  candidate: ProviderModelCandidate,
  prompt: ProviderPromptMessage[],
  controls: ProviderCallControls = {},
): Promise<ProviderInvocationResult> {
  const apiKey = resolveSecretFromRef(candidate.secretRef ?? "GEMINI_API_KEY");

  const providerCall = await callProviderWithControls({
    ...controls,
    modelId: candidate.modelId,
    providerName: candidate.providerName,
    url: `https://generativelanguage.googleapis.com/v1beta/models/${candidate.externalModelKey}:generateContent`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: getGeminiSystemInstruction(prompt, candidate) }],
        },
        contents: toGeminiContents(prompt),
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
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
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

    const promptTexts = prompt.flatMap((message) =>
      message.content
        .filter((item) => item.type === "text")
        .map((item) => item.text),
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

export const geminiDriver: ProviderDriver = {
  key: "gemini",
  async testConnection(input) {
    const checkedAt = new Date().toISOString();
    let apiKey: string;
    try {
      apiKey = resolveSecretFromRef(input.secretRef ?? "GEMINI_API_KEY");
    } catch {
      return {
        ok: false,
        status: "missing_key",
        failureCode: "provider_unavailable",
        checkedAt,
        message: "Gemini API key is not configured.",
      };
    }

    const providerCall = await callProviderWithControls({
      ...(input.controls ?? {}),
      modelId: input.providerModelId,
      providerName: input.providerName ?? "Google Gemini",
      url: `https://generativelanguage.googleapis.com/v1beta/models/${input.providerModelId}`,
      init: {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
        },
      },
    });

    return toConnectionResult(providerCall, checkedAt);
  },
  async invokeChat(input) {
    return invokeGemini(
      {
        providerId: "prv_gemini",
        providerName: input.providerName,
        modelId: input.providerModelId,
        modelName: input.modelName,
        externalModelKey: input.providerModelId,
        providerPriority: 1,
        modelPriority: 1,
        baseType: "gemini",
        secretRef: input.secretRef,
      },
      input.prompt,
      { timeoutMs: input.timeoutMs },
    );
  },
};

function getGeminiSystemInstruction(
  prompt: ProviderPromptMessage[],
  candidate: ProviderModelCandidate,
) {
  const systemText = prompt
    .filter((message) => message.role === "system" || message.role === "developer")
    .flatMap((message) =>
      message.content
        .filter((item) => item.type === "text")
        .map((item) => item.text),
    )
    .join("\n");

  return systemText || buildModelIdentityInstruction({
    modelName: candidate.modelName,
    providerName: candidate.providerName,
  });
}

function toGeminiContents(prompt: ProviderPromptMessage[]) {
  return prompt
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: message.content.map((item) =>
        item.type === "text"
          ? { text: item.text }
          : {
              inline_data: {
                mime_type: item.mimeType,
                data: item.data,
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
