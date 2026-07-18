import { badRequest } from "../../lib/http-errors.js";
import type { ProviderPromptMessage } from "../chat/prompt-assembly.js";
import type {
  ProviderFailureCode,
  ProviderInvocationResult,
  ProviderStatusState,
  ProviderUsage,
} from "./types.js";
import type { ProviderCallControls } from "./provider-call.js";

export interface DriverTestConnectionInput {
  providerModelId: string;
  providerName?: string;
  secretRef: string | null;
  controls?: ProviderCallControls;
}

export type DriverTestConnectionResult =
  | {
      ok: true;
      status: "connected";
      checkedAt: string;
    }
  | {
      ok: false;
      status: Exclude<ProviderStatusState, "connected" | "disabled">;
      failureCode: ProviderFailureCode;
      checkedAt: string;
      message: string;
    };

export interface DriverInvokeInput {
  providerModelId: string;
  modelName: string;
  providerName: string;
  secretRef: string | null;
  prompt: ProviderPromptMessage[];
  timeoutMs?: number;
}

export interface ProviderDriver {
  key: string;
  testConnection(input: DriverTestConnectionInput): Promise<DriverTestConnectionResult>;
  invokeChat(input: DriverInvokeInput): Promise<ProviderInvocationResult>;
}

export interface ProviderDriverRegistry {
  getDriver(key: string): ProviderDriver | null;
}

export function createProviderDriverRegistry(drivers: ProviderDriver[]): ProviderDriverRegistry {
  const byKey = new Map(drivers.map((driver) => [driver.key, driver]));

  return {
    getDriver(key) {
      return byKey.get(key) ?? null;
    },
  };
}

export function resolveSecretFromRef(secretRef: string | null) {
  if (!secretRef) {
    throw badRequest("No secret reference is configured for this model.");
  }

  const value = process.env[secretRef];
  if (!value) {
    throw badRequest(`Environment secret ${secretRef} is not configured.`);
  }

  return value;
}

export function estimateUsageFromHistory(
  promptTexts: string[],
  completionText: string,
): ProviderUsage {
  const inputTokens = roughTokenEstimate(promptTexts.join("\n"));
  const outputTokens = roughTokenEstimate(completionText);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

export function buildModelIdentityInstruction(input: {
  modelName: string;
  providerName: string;
}) {
  return [
    `You are currently running as the model "${input.modelName}" via the provider "${input.providerName}".`,
    `If the user asks which model or provider is responding, answer with exactly that identity.`,
    "Do not claim to be GPT, OpenAI, Claude, Gemini, or any other model unless it matches this runtime identity.",
  ].join(" ");
}

function roughTokenEstimate(text: string) {
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}
