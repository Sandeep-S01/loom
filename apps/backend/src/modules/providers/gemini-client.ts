import type { MessageRecord } from "../conversations/repository.js";
import type { ProviderInvocationResult, ProviderModelCandidate } from "./types.js";

export async function invokeGemini(
  candidate: ProviderModelCandidate,
  history: MessageRecord[],
): Promise<ProviderInvocationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, failureCode: "auth_invalid" };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${candidate.externalModelKey}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: history.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: message.content.map((item) => ({ text: item.text })),
          })),
        }),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        failureCode: classifyHttpFailure(response.status),
      };
    }

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
