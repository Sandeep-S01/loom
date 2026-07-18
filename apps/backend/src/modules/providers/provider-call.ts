import type {
  NormalizedProviderError,
  ProviderFailureCode,
} from "./types.js";

type FetchFn = typeof fetch;

export interface ProviderCallControls {
  fetchFn?: FetchFn;
  jitterMs?: () => number;
  maxAttempts?: number;
  maxRetryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export interface ProviderCallInput extends ProviderCallControls {
  init: RequestInit;
  modelId: string;
  providerName: string;
  url: string;
}

export type ProviderCallResult =
  | {
      ok: true;
      attempts: number;
      latencyMs: number;
      response: Response;
    }
  | {
      ok: false;
      attempts: number;
      error: NormalizedProviderError;
      failureCode: ProviderFailureCode;
      latencyMs: number;
      retryAfterSeconds?: number | null;
    };

const DEFAULT_TIMEOUT_MS = Number.parseInt(
  process.env.PROVIDER_REQUEST_TIMEOUT_MS ?? "60000",
  10,
);
const DEFAULT_MAX_ATTEMPTS = Number.parseInt(
  process.env.PROVIDER_MAX_ATTEMPTS ?? "2",
  10,
);
const DEFAULT_BASE_BACKOFF_MS = 300;
const DEFAULT_MAX_BACKOFF_MS = 5_000;

export async function callProviderWithControls(
  input: ProviderCallInput,
): Promise<ProviderCallResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const maxAttempts = Math.max(1, input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = Math.max(1, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const maxRetryDelayMs = Math.max(
    1,
    input.maxRetryDelayMs ?? DEFAULT_MAX_BACKOFF_MS,
  );
  const sleep = input.sleep ?? defaultSleep;
  const jitterMs = input.jitterMs ?? (() => Math.floor(Math.random() * 150));
  const startedAt = Date.now();
  let lastError: NormalizedProviderError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      return toFailureResult(
        normalizeProviderFailure({
          failureCode: "provider_timeout",
          modelId: input.modelId,
          providerName: input.providerName,
        }),
        Math.max(1, attempt - 1),
        startedAt,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);

    try {
      const response = await fetchFn(input.url, {
        ...input.init,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return {
          ok: true,
          attempts: attempt,
          latencyMs: Date.now() - startedAt,
          response,
        };
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const error = normalizeProviderFailure({
        modelId: input.modelId,
        providerName: input.providerName,
        retryAfterMs,
        statusCode: response.status,
      });
      lastError = error;

      if (!shouldRetry(error, attempt, maxAttempts)) {
        return toFailureResult(error, attempt, startedAt);
      }

      const delayMs = resolveBackoffMs(
        attempt,
        retryAfterMs,
        jitterMs,
        maxRetryDelayMs,
      );
      await sleep(Math.min(delayMs, Math.max(0, timeoutMs - (Date.now() - startedAt))));
    } catch (error) {
      clearTimeout(timeout);

      const normalized = normalizeProviderFailure({
        failureCode: isAbortError(error) ? "provider_timeout" : "provider_unavailable",
        modelId: input.modelId,
        providerName: input.providerName,
      });
      lastError = normalized;

      if (!shouldRetry(normalized, attempt, maxAttempts)) {
        return toFailureResult(normalized, attempt, startedAt);
      }

      const delayMs = resolveBackoffMs(
        attempt,
        normalized.retryAfterMs,
        jitterMs,
        maxRetryDelayMs,
      );
      await sleep(Math.min(delayMs, Math.max(0, timeoutMs - (Date.now() - startedAt))));
    }
  }

  return toFailureResult(
    lastError ??
      normalizeProviderFailure({
        failureCode: "unknown_provider_error",
        modelId: input.modelId,
        providerName: input.providerName,
      }),
    maxAttempts,
    startedAt,
  );
}

export function normalizeProviderFailure(input: {
  failureCode?: ProviderFailureCode;
  modelId?: string;
  providerName?: string;
  retryAfterMs?: number | null;
  statusCode?: number;
}): NormalizedProviderError {
  const code = input.failureCode
    ? normalizeFailureCode(input.failureCode)
    : normalizeStatusCode(input.statusCode);
  const retryAfterMs = input.retryAfterMs ?? undefined;

  return {
    code,
    retryable: isRetryableCode(code),
    message: getSafeProviderMessage(code, input.providerName),
    modelId: input.modelId,
    providerName: input.providerName,
    retryAfterMs,
    statusCode: input.statusCode,
  };
}

export function normalizeFailureCode(
  failureCode: ProviderFailureCode,
): NormalizedProviderError["code"] {
  switch (failureCode) {
    case "provider_timeout":
      return "provider_timeout";
    case "provider_unavailable":
    case "provider_unreachable":
      return "provider_unavailable";
    case "provider_rate_limited":
    case "rate_limited_transient":
    case "quota_exhausted":
      return "provider_rate_limited";
    case "invalid_api_key":
    case "auth_invalid":
      return "invalid_api_key";
    case "model_not_found":
      return "model_not_found";
    case "context_too_large":
      return "context_too_large";
    case "provider_5xx":
      return "provider_5xx";
    case "provider_4xx":
    case "policy_blocked":
      return "provider_4xx";
    case "unknown_provider_error":
    case "invalid_response":
    default:
      return "unknown_provider_error";
  }
}

export function toProviderFailureCode(
  code: NormalizedProviderError["code"],
): ProviderFailureCode {
  return code;
}

function normalizeStatusCode(statusCode?: number): NormalizedProviderError["code"] {
  if (statusCode === 401 || statusCode === 403) return "invalid_api_key";
  if (statusCode === 404) return "model_not_found";
  if (statusCode === 413 || statusCode === 422) return "context_too_large";
  if (statusCode === 429) return "provider_rate_limited";
  if (statusCode != null && statusCode >= 500) return "provider_5xx";
  if (statusCode != null && statusCode >= 400) return "provider_4xx";
  return "unknown_provider_error";
}

function isRetryableCode(code: NormalizedProviderError["code"]) {
  return (
    code === "provider_timeout" ||
    code === "provider_rate_limited" ||
    code === "provider_5xx" ||
    code === "provider_unavailable"
  );
}

function shouldRetry(
  error: NormalizedProviderError,
  attempt: number,
  maxAttempts: number,
) {
  return (
    error.retryable &&
    error.code !== "provider_rate_limited" &&
    attempt < maxAttempts
  );
}

function resolveBackoffMs(
  attempt: number,
  retryAfterMs: number | undefined,
  jitterMs: () => number,
  maxRetryDelayMs: number,
) {
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return Math.min(retryAfterMs, maxRetryDelayMs);
  }

  return Math.min(
    DEFAULT_BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1) + jitterMs(),
    maxRetryDelayMs,
  );
}

function toFailureResult(
  error: NormalizedProviderError,
  attempts: number,
  startedAt: number,
): Extract<ProviderCallResult, { ok: false }> {
  return {
    ok: false,
    attempts,
    error,
    failureCode: toProviderFailureCode(error.code),
    latencyMs: Date.now() - startedAt,
    retryAfterSeconds:
      error.retryAfterMs !== undefined ? Math.ceil(error.retryAfterMs / 1000) : null,
  };
}

function parseRetryAfterMs(headerValue: string | null) {
  if (!headerValue) return undefined;
  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function getSafeProviderMessage(
  code: NormalizedProviderError["code"],
  providerName?: string,
) {
  const target = providerName ? `${providerName} ` : "The selected provider ";

  switch (code) {
    case "provider_timeout":
      return `${target}timed out. Loom will try another available model when possible.`;
    case "provider_rate_limited":
      return `${target}is currently rate-limited. Try again shortly or use another model.`;
    case "invalid_api_key":
      return `${target}API key is invalid or unauthorized. Check the model registry settings.`;
    case "model_not_found":
      return `${target}model could not be found. Check the configured provider model ID.`;
    case "context_too_large":
      return "The request is too large for the selected model. Reduce context or choose a larger-context model.";
    case "provider_5xx":
      return `${target}is temporarily unavailable. Loom will try another available model when possible.`;
    case "provider_4xx":
      return `${target}rejected the request. Check the selected model and request format.`;
    case "provider_unavailable":
      return `${target}is unreachable. Loom will try another available model when possible.`;
    case "unknown_provider_error":
    default:
      return `${target}returned an unexpected error. Try again or choose another model.`;
  }
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
