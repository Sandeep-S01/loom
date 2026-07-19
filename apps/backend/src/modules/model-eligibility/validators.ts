import { badRequest } from "../../lib/http-errors.js";
import type {
  EligibilityMode,
  EligibilityPurpose,
  EligibilityRequestContext,
} from "./domain.js";

const MAX_TOKEN_ESTIMATE = 10_000_000;

export function parseEligibilityQuery(
  query: Record<string, unknown>,
): EligibilityRequestContext {
  return {
    mode: parseMode(optionalString(query.mode)),
    purpose: parsePurpose(optionalString(query.purpose)),
    companionAvailable: parseBoolean(optionalString(query.companionAvailable), false),
    estimatedInputTokens: parseOptionalTokenEstimate(
      optionalString(query.estimatedInputTokens),
      "estimatedInputTokens",
    ),
    requestedOutputTokens: parseOptionalTokenEstimate(
      optionalString(query.requestedOutputTokens),
      "requestedOutputTokens",
    ),
    includeIneligible: parseBoolean(optionalString(query.includeIneligible), false),
  };
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function parseMode(value: string | undefined): EligibilityMode {
  if (!value || value === "chat") return "chat";
  if (value === "agent") return "agent";
  throw badRequest("mode must be chat or agent.");
}

function parsePurpose(value: string | undefined): EligibilityPurpose {
  if (!value || value === "selector") return "selector";
  if (value === "routing" || value === "admin_diagnostics") return value;
  throw badRequest("purpose must be selector, routing, or admin_diagnostics.");
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw badRequest("Boolean query values must be true or false.");
}

function parseOptionalTokenEstimate(value: string | undefined, field: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_TOKEN_ESTIMATE
  ) {
    throw badRequest(`${field} must be an integer between 0 and ${MAX_TOKEN_ESTIMATE}.`);
  }
  return parsed;
}
