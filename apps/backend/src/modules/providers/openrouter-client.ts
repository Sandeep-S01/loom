import type { MessageRecord } from "../conversations/repository.js";
import type { ProviderInvocationResult, ProviderModelCandidate } from "./types.js";

export async function invokeOpenRouter(
  candidate: ProviderModelCandidate,
  history: MessageRecord[],
): Promise<ProviderInvocationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, failureCode: "auth_invalid" };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: candidate.externalModelKey,
        max_tokens: 512,
        messages: history.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content.map((item) => item.text).join("\n"),
        })),
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        failureCode: classifyHttpFailure(response.status),
      };
    }

    const body = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, failureCode: "invalid_response" };
    }

    return { ok: true, text };
  } catch {
    return { ok: false, failureCode: "provider_unreachable" };
  }
}

function classifyHttpFailure(status: number) {
  if (status === 401 || status === 403) return "auth_invalid" as const;
  if (status === 429) return "quota_exhausted" as const;
  if (status >= 500) return "provider_5xx" as const;
  return "invalid_response" as const;
}
