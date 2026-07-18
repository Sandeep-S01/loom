import type {
  ChatContextBlockRequest,
  ChatContextMetadata,
  MessageContent,
  SendMessageResponse,
} from "@clm/shared-types";
import { generateId } from "@clm/shared-utils";
import { badRequest, notFound } from "../../lib/http-errors.js";
import type {
  ConversationRepository,
  MessageRecord,
} from "../conversations/repository.js";
import type { CooldownTracker } from "../providers/cooldown-tracker.js";
import { selectNextModel, type ModelCapability } from "../providers/router.js";
import type {
  NormalizedProviderError,
  ProviderFailureCode,
  ProviderInvocationResult,
  ProviderUsage,
} from "../providers/types.js";
import { normalizeProviderFailure } from "../providers/provider-call.js";
import type {
  ChatIdempotencyStore,
  ConcurrencyLimiter,
  FixedWindowRateLimiter,
} from "./load-control.js";
import {
  assemblePrompt,
  PromptAssemblyError,
  type PromptAssemblyMetadata,
  type ProviderPromptMessage,
} from "./prompt-assembly.js";

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PROVIDER_HISTORY_LIMIT = 40;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_TEXT_CHARS = 20_000;
const DEFAULT_CONTEXT_WINDOW_TOKENS = 4096;
const DEFAULT_RESERVED_RESPONSE_TOKENS = 512;
const DEFAULT_MAX_WORKSPACE_CONTEXT_TOKENS = 1200;
const DEFAULT_MAX_CONTEXT_BLOCK_TOKENS = 400;
const DEFAULT_MAX_CONTEXT_BLOCKS = 8;
const DEFAULT_MAX_CONTEXT_FILE_BYTES = 64 * 1024;
const DEFAULT_MAX_USER_MESSAGE_CONTEXT_TOKENS = 2000;

export interface ProviderCandidate {
  providerId: string;
  providerName?: string;
  modelId: string;
  modelName: string;
  externalModelKey?: string;
  baseType?: string;
  providerPriority?: number;
  modelPriority?: number;
  supportsChat?: boolean;
  supportsAgent?: boolean;
  supportsVision?: boolean;
  secretRef?: string | null;
  requestsPerMinuteLimit?: number | null;
  contextWindow?: number | null;
}

export type ProviderInvoker = (
  candidate: ProviderCandidate,
  prompt: ProviderPromptMessage[],
  routingTraceId: string,
  controls?: { timeoutMs?: number },
) => Promise<ProviderInvocationResult>;

export interface ChatService {
  sendMessage(input: {
    userId: string;
    conversationId: string;
    mode?: "chat" | "agent";
    selectedModelId?: string;
    idempotencyKey?: string;
    workspaceId?: string;
    contextBlocks?: ChatContextBlockRequest[];
    content: MessageContent[];
  }): Promise<SendMessageResponse>;
}

interface CreateChatServiceOptions {
  conversationRepository: ConversationRepository;
  providerCandidates?: ProviderCandidate[];
  getProviderCandidates?: () => Promise<ProviderCandidate[]>;
  invokeProvider: ProviderInvoker;
  cooldownTracker?: CooldownTracker;
  recordProviderAttempt?: (input: {
    conversationId: string;
    routingTraceId: string;
    providerId: string;
    modelId: string;
    attemptNo: number;
    status: "success" | "failed";
    failureCode?: ProviderFailureCode;
    usage?: ProviderUsage;
    startedAt: Date;
    endedAt: Date;
  }) => Promise<void>;
  onProviderSuccess?: (input: {
    modelId: string;
    usage?: ProviderUsage;
  }) => Promise<void>;
  onProviderFailure?: (input: {
    modelId: string;
    failureCode: ProviderFailureCode;
    retryAfterSeconds?: number | null;
  }) => Promise<void>;
  logProviderAttempt?: (input: {
    requestId: string;
    conversationId: string;
    selectedModelId?: string;
    attemptedModelId: string;
    providerId: string;
    providerName?: string;
    attemptNo: number;
    latencyMs: number;
    status: "success" | "failed";
    fallbackUsed: boolean;
    errorCode?: string;
    tokenUsage?: ProviderUsage;
  }) => void;
  idempotencyStore?: ChatIdempotencyStore;
  idempotencyTtlMs?: number;
  concurrencyLimiter?: ConcurrencyLimiter;
  chatRateLimiter?: FixedWindowRateLimiter;
  chatRequestsPerMinuteLimit?: number;
  modelRateLimiter?: FixedWindowRateLimiter;
  maxProviderHistoryMessages?: number;
  maxTextChars?: number;
  requestDeadlineMs?: number;
  reservedResponseTokens?: number;
  maxWorkspaceContextTokens?: number;
  maxContextBlockTokens?: number;
  maxContextBlocks?: number;
  maxContextFileBytes?: number;
  maxUserMessageContextTokens?: number;
  logPromptAssembly?: (input: {
    requestId: string;
    conversationId: string;
    workspaceId?: string;
    modelId: string;
    includedContextCount: number;
    excludedContextCount: number;
    estimatedPromptTokens: number;
    truncatedContext: boolean;
  }) => void;
}

export function createChatService(
  options: CreateChatServiceOptions,
): ChatService {
  return {
    async sendMessage(input) {
      const conversation = await options.conversationRepository.findForUser(
        input.userId,
        input.conversationId,
      );

      if (!conversation) {
        throw notFound("Conversation not found");
      }
      validateMessageContent(input.content, {
        maxTextChars: options.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS,
      });

      const routingTraceId = `route_${generateId("request").slice(4)}`;
      const idempotencyKey = input.idempotencyKey?.trim();

      if (idempotencyKey) {
        const idempotencyStart = await options.idempotencyStore?.start({
          userId: input.userId,
          conversationId: input.conversationId,
          idempotencyKey,
          requestId: routingTraceId,
          expiresAt: new Date(
            Date.now() + (options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS),
          ),
        });

        if (idempotencyStart?.status === "completed") {
          return idempotencyStart.response;
        }

        if (idempotencyStart?.status === "processing") {
          return capacityBlockedResponse({
            code: "request_already_processing",
            message: "This request is already being processed.",
            requestId: idempotencyStart.requestId,
          });
        }
      }

      const chatRateLimit = options.chatRequestsPerMinuteLimit;
      if (chatRateLimit && options.chatRateLimiter) {
        const chatRateResult = options.chatRateLimiter.tryConsume({
          key: `chat:${input.userId}`,
          limit: chatRateLimit,
          windowMs: RATE_LIMIT_WINDOW_MS,
        });

        if (!chatRateResult.allowed) {
          await markIdempotencyFailed(options, input, idempotencyKey, "chat_rate_limited");
          return capacityBlockedResponse({
            code: "chat_rate_limited",
            message: "Too many chat requests. Please retry shortly.",
            requestId: routingTraceId,
            retryAfterMs: chatRateResult.retryAfterMs,
          });
        }
      }

      const concurrencyLease = options.concurrencyLimiter?.tryAcquire({
        globalKey: "chat",
        conversationId: input.conversationId,
      });

      if (concurrencyLease && !concurrencyLease.acquired) {
        await markIdempotencyFailed(
          options,
          input,
          idempotencyKey,
          "request_concurrency_limited",
        );
        return capacityBlockedResponse({
          code: "request_concurrency_limited",
          message:
            "This workspace is already processing the maximum number of chat requests. Please retry shortly.",
          requestId: routingTraceId,
        });
      }

      try {
        const userMessage = await options.conversationRepository.appendMessage({
          conversationId: input.conversationId,
          role: "user",
          content: input.content,
        });

      const history = await options.conversationRepository.listMessages(
        input.conversationId,
        { limit: options.maxProviderHistoryMessages ?? DEFAULT_PROVIDER_HISTORY_LIMIT },
      );
      const priorHistory = history.filter((message) => message.id !== userMessage.id);
      const providerCandidates =
        options.providerCandidates ?? (await options.getProviderCandidates?.()) ?? [];
      const requestHasImage = input.content.some((item) => item.type === "image");
      const rankedProviderCandidates = prioritizeSelectedModel(
        providerCandidates,
        input.selectedModelId,
      );
      const hasVisionCandidate = rankedProviderCandidates.some(
        (candidate) => candidate.supportsVision === true,
      );

      const capability: ModelCapability = input.mode === "agent" ? "agent" : "chat";
      const requestDeadlineAt =
        Date.now() + (options.requestDeadlineMs ?? 90_000);
      const maxAttempts = rankedProviderCandidates.length;
      const failedModelIds = new Set<string>();
      let lastFailedCandidate: ProviderCandidate | null = null;
      let lastFailureCode: ProviderFailureCode | null = null;
      let lastError: NormalizedProviderError | null = null;
      let attemptNo = 0;

      while (attemptNo < maxAttempts) {
        const cooldownMap = options.cooldownTracker?.getCooldownMap();

        const candidate = selectNextModel(
          rankedProviderCandidates.map((item) => ({
            ...item,
            providerPriority: item.providerPriority ?? 1,
            modelPriority: item.modelPriority ?? 1,
          })),
          failedModelIds,
          { capability, cooldownMap, requiresVision: requestHasImage },
        );

        if (!candidate) {
          break;
        }

        let assembledPrompt: {
          messages: ProviderPromptMessage[];
          metadata: PromptAssemblyMetadata;
        };
        try {
          assembledPrompt = assemblePrompt({
            modelName: candidate.modelName,
            providerName: candidate.providerName ?? "Unknown provider",
            currentUserContent: input.content,
            history: priorHistory,
            contextBlocks: input.contextBlocks,
            maxFileSizeBytes: options.maxContextFileBytes ?? DEFAULT_MAX_CONTEXT_FILE_BYTES,
            budget: {
              contextWindowTokens:
                candidate.contextWindow ?? DEFAULT_CONTEXT_WINDOW_TOKENS,
              reservedResponseTokens:
                options.reservedResponseTokens ?? DEFAULT_RESERVED_RESPONSE_TOKENS,
              maxWorkspaceContextTokens:
                options.maxWorkspaceContextTokens ?? DEFAULT_MAX_WORKSPACE_CONTEXT_TOKENS,
              maxTokensPerContextBlock:
                options.maxContextBlockTokens ?? DEFAULT_MAX_CONTEXT_BLOCK_TOKENS,
              maxContextBlocks: options.maxContextBlocks ?? DEFAULT_MAX_CONTEXT_BLOCKS,
              maxUserMessageTokens:
                options.maxUserMessageContextTokens ?? DEFAULT_MAX_USER_MESSAGE_CONTEXT_TOKENS,
            },
          });
        } catch (error) {
          if (error instanceof PromptAssemblyError) {
            lastError = normalizeProviderFailure({
              failureCode: "context_too_large",
              modelId: candidate.modelId,
              providerName: candidate.providerName,
            });
            lastFailureCode = "context_too_large";
            break;
          }
          throw error;
        }

        options.logPromptAssembly?.({
          requestId: routingTraceId,
          conversationId: input.conversationId,
          workspaceId: input.workspaceId,
          modelId: candidate.modelId,
          includedContextCount: assembledPrompt.metadata.includedContextCount,
          excludedContextCount: assembledPrompt.metadata.excludedContextCount,
          estimatedPromptTokens: assembledPrompt.metadata.estimatedPromptTokens,
          truncatedContext: assembledPrompt.metadata.truncatedContext,
        });

        const modelRateLimit = candidate.requestsPerMinuteLimit ?? null;
        if (modelRateLimit && options.modelRateLimiter) {
          const modelRateResult = options.modelRateLimiter.tryConsume({
            key: `model:${candidate.modelId}`,
            limit: modelRateLimit,
            windowMs: RATE_LIMIT_WINDOW_MS,
          });

          if (!modelRateResult.allowed) {
            const now = new Date();
            attemptNo += 1;
            await options.recordProviderAttempt?.({
              conversationId: input.conversationId,
              routingTraceId,
              providerId: candidate.providerId,
              modelId: candidate.modelId,
              attemptNo,
              status: "failed",
              failureCode: "provider_rate_limited",
              startedAt: now,
              endedAt: now,
            });
            failedModelIds.add(candidate.modelId);
            lastFailedCandidate = candidate;
            lastFailureCode = "provider_rate_limited";
            lastError = normalizeProviderFailure({
              failureCode: "provider_rate_limited",
              modelId: candidate.modelId,
              providerName: candidate.providerName,
              retryAfterMs: modelRateResult.retryAfterMs,
            });
            continue;
          }
        }

        attemptNo += 1;
        const startedAt = new Date();
        const remainingRequestMs = requestDeadlineAt - Date.now();
        if (remainingRequestMs <= 0) {
          lastError = normalizeProviderFailure({
            failureCode: "provider_timeout",
            modelId: candidate.modelId,
            providerName: candidate.providerName,
          });
          lastFailureCode = "provider_timeout";
          break;
        }
        const result = await options.invokeProvider(
          candidate,
          assembledPrompt.messages,
          routingTraceId,
          { timeoutMs: remainingRequestMs },
        );
        const endedAt = new Date();

        if (result.ok) {
          const latencyMs = endedAt.getTime() - startedAt.getTime();
          await options.recordProviderAttempt?.({
            conversationId: input.conversationId,
            routingTraceId,
            providerId: candidate.providerId,
            modelId: candidate.modelId,
            attemptNo,
            status: "success",
            usage: result.usage,
            startedAt,
            endedAt,
          });
          options.logProviderAttempt?.({
            requestId: routingTraceId,
            conversationId: input.conversationId,
            selectedModelId: input.selectedModelId,
            attemptedModelId: candidate.modelId,
            providerId: candidate.providerId,
            providerName: candidate.providerName,
            attemptNo,
            latencyMs,
            status: "success",
            fallbackUsed: attemptNo > 1,
            tokenUsage: result.usage,
          });
          await options.onProviderSuccess?.({
            modelId: candidate.modelId,
            usage: result.usage,
          });

          const assistantMessage = await options.conversationRepository.appendMessage({
            conversationId: input.conversationId,
            role: "assistant",
            content: [{ type: "text", text: result.text }],
            providerId: candidate.providerId,
            modelId: candidate.modelId,
          });

          const response: SendMessageResponse = {
            userMessage: {
              id: userMessage.id,
              role: "user",
            },
            assistantMessage: mapMessageRecord(assistantMessage),
            provider: {
              providerId: candidate.providerId,
              modelId: candidate.modelId,
              modelName: candidate.modelName,
            },
            providerSwitched:
              lastFailedCandidate && lastFailureCode
                ? {
                    switched: true,
                    fromModelId: lastFailedCandidate.modelId,
                    fromModelName: lastFailedCandidate.modelName,
                    toModelId: candidate.modelId,
                    toModelName: candidate.modelName,
                    reason: lastFailureCode,
                  }
                : null,
            routingTraceId,
            capacityBlocked: false,
            context: toResponseContextMetadata(assembledPrompt.metadata, routingTraceId),
          };
          await markIdempotencyCompleted(options, input, idempotencyKey, response);
          return response;
        }

        const normalizedError =
          result.error ??
          normalizeProviderFailure({
            failureCode: result.failureCode,
            modelId: candidate.modelId,
            providerName: candidate.providerName,
            retryAfterMs:
              result.retryAfterSeconds != null
                ? result.retryAfterSeconds * 1000
                : undefined,
          });
        const normalizedFailureCode = normalizedError.code;
        const latencyMs = endedAt.getTime() - startedAt.getTime();

        await options.recordProviderAttempt?.({
          conversationId: input.conversationId,
          routingTraceId,
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          attemptNo,
          status: "failed",
          failureCode: normalizedFailureCode,
          startedAt,
          endedAt,
        });
        options.logProviderAttempt?.({
          requestId: routingTraceId,
          conversationId: input.conversationId,
          selectedModelId: input.selectedModelId,
          attemptedModelId: candidate.modelId,
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          attemptNo,
          latencyMs,
          status: "failed",
          fallbackUsed: attemptNo > 1,
          errorCode: normalizedError.code,
        });
        await options.onProviderFailure?.({
          modelId: candidate.modelId,
          failureCode: normalizedFailureCode,
          retryAfterSeconds: result.retryAfterSeconds,
        });

        // Mark cooldown on the global tracker
        options.cooldownTracker?.markCooldown(candidate.modelId, normalizedFailureCode);

        failedModelIds.add(candidate.modelId);
        lastFailedCandidate = candidate;
        lastFailureCode = normalizedFailureCode;
        lastError = normalizedError;

        if (!normalizedError.retryable) {
          break;
        }
      }

      // All candidates exhausted or maxAttempts reached
      const exhaustedError = requestHasImage && !lastError
        ? hasVisionCandidate
          ? {
              code: "VISION_MODELS_EXHAUSTED",
              message:
                "Vision-capable models are currently unavailable or rate-limited. Try again shortly or choose another vision model.",
              requestId: routingTraceId,
            }
          : {
              code: "VISION_MODEL_UNAVAILABLE",
              message:
                "No vision-capable model is available right now. Enable or wait for a Gemini/vision model, then try again.",
              requestId: routingTraceId,
            }
        : lastError
          ? {
              code: requestHasImage && hasVisionCandidate && lastError.retryable
                ? "VISION_MODELS_EXHAUSTED"
                : lastError.code,
              message: requestHasImage && hasVisionCandidate && lastError.retryable
                ? "Vision-capable models are currently unavailable or rate-limited. Try again shortly or choose another vision model."
                : lastError.message,
              requestId: routingTraceId,
            }
          : {
            code: "CAPACITY_EXHAUSTED",
            message: "All currently configured free models are unavailable.",
            requestId: routingTraceId,
          };

      const response: SendMessageResponse = {
        userMessage: {
          id: userMessage.id,
          role: "user",
        },
        assistantMessage: null,
        provider: null,
        providerSwitched: null,
        routingTraceId,
        capacityBlocked: true,
        error: exhaustedError,
      };
      await markIdempotencyCompleted(options, input, idempotencyKey, response);
      return response;
      } catch (error) {
        await markIdempotencyFailed(options, input, idempotencyKey, "chat_request_failed");
        throw error;
      } finally {
        if (concurrencyLease?.acquired) {
          concurrencyLease.release();
        }
      }
    },
  };
}

function validateMessageContent(
  content: MessageContent[],
  limits: { maxTextChars: number },
) {
  if (content.length === 0) {
    throw badRequest("Message content is required.");
  }

  const text = content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("")
    .trim();
  const images = content.filter((item) => item.type === "image");

  if (!text && images.length === 0) {
    throw badRequest("Message content is required.");
  }

  if (text.length > limits.maxTextChars) {
    throw badRequest(`Message text must be ${limits.maxTextChars} characters or fewer.`);
  }

  if (images.length > 4) {
    throw badRequest("Attach up to 4 images per message.");
  }

  let totalImageBytes = 0;
  for (const image of images) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)) {
      throw badRequest("Only PNG, JPEG, and WebP images are supported.");
    }

    if (!image.data.trim() || image.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) {
      throw badRequest("Image data must be valid base64.");
    }

    const decodedSize = Buffer.from(image.data, "base64").byteLength;
    if (decodedSize !== image.size) {
      throw badRequest("Image size does not match its encoded data.");
    }

    if (decodedSize > 5 * 1024 * 1024) {
      throw badRequest("Images must be 5 MB or smaller.");
    }
    totalImageBytes += decodedSize;
  }

  if (totalImageBytes > 15 * 1024 * 1024) {
    throw badRequest("Images must total 15 MB or less.");
  }
}

function capacityBlockedResponse(input: {
  code: string;
  message: string;
  requestId: string;
  retryAfterMs?: number;
}): SendMessageResponse {
  const response = {
    userMessage: {
      id: "",
      role: "user",
    },
    assistantMessage: null,
    provider: null,
    providerSwitched: null,
    routingTraceId: input.requestId,
    capacityBlocked: true,
    error: {
      code: input.code,
      message: input.message,
      requestId: input.requestId,
    },
  };
  return response as SendMessageResponse;
}

function toResponseContextMetadata(
  metadata: PromptAssemblyMetadata,
  requestId: string,
): ChatContextMetadata {
  return {
    workspaceContextUsed: metadata.workspaceContextUsed,
    includedContextCount: metadata.includedContextCount,
    excludedContextCount: metadata.excludedContextCount,
    truncatedContext: metadata.truncatedContext,
    estimatedPromptTokens: metadata.estimatedPromptTokens,
    requestId,
  };
}

async function markIdempotencyCompleted(
  options: CreateChatServiceOptions,
  input: {
    userId: string;
    conversationId: string;
  },
  idempotencyKey: string | undefined,
  response: SendMessageResponse,
) {
  if (!idempotencyKey) {
    return;
  }

  await options.idempotencyStore?.complete({
    userId: input.userId,
    conversationId: input.conversationId,
    idempotencyKey,
    response,
  });
}

async function markIdempotencyFailed(
  options: CreateChatServiceOptions,
  input: {
    userId: string;
    conversationId: string;
  },
  idempotencyKey: string | undefined,
  errorCode: string,
) {
  if (!idempotencyKey) {
    return;
  }

  await options.idempotencyStore?.fail({
    userId: input.userId,
    conversationId: input.conversationId,
    idempotencyKey,
    errorCode,
  });
}

function mapMessageRecord(message: MessageRecord) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    providerId: message.providerId,
    modelId: message.modelId,
    createdAt: message.createdAt,
  };
}

function prioritizeSelectedModel(
  candidates: ProviderCandidate[],
  selectedModelId?: string,
) {
  if (!selectedModelId) {
    return candidates;
  }

  const selectedCandidate = candidates.find(
    (candidate) => candidate.modelId === selectedModelId,
  );

  if (!selectedCandidate) {
    throw badRequest("Selected model is unavailable.");
  }

  return [
    {
      ...selectedCandidate,
      providerPriority: 0,
      modelPriority: 0,
    },
    ...candidates.filter((candidate) => candidate.modelId !== selectedModelId),
  ];
}
