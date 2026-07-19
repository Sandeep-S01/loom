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
import type { ModelRoutingService } from "../model-routing/interfaces.js";
import type { ModelFallbackService } from "../model-fallback/interfaces.js";
import type { ModelUsageService } from "../model-usage/interfaces.js";
import type { AuditService } from "../audit/interfaces.js";
import type { EligibleModelCandidate } from "../model-eligibility/domain.js";
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
  legacyModelId?: string | null;
  registryModelId?: string;
  catalogModelId?: string;
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
  modelRoutingService?: ModelRoutingService;
  modelFallbackService?: ModelFallbackService;
  modelUsageService?: ModelUsageService;
  auditService?: AuditService;
  cooldownTracker?: CooldownTracker;
  recordProviderAttempt?: (input: {
    conversationId: string;
    routingTraceId: string;
    providerId: string;
    modelId?: string | null;
    registryModelId?: string | null;
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
  logIntegrationError?: (input: {
    event: string;
    requestId?: string;
    conversationId?: string;
    error: unknown;
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
      const capability: ModelCapability = input.mode === "agent" ? "agent" : "chat";
      const routingSelection = await selectInitialChatRoute({
        options,
        input,
        mode: capability,
        requestId: routingTraceId,
        estimatedInputTokens: estimateMessageTokens(input.content),
      });
      if (routingSelection && !routingSelection.model) {
        const response = capacityBlockedResponse({
          code: routingSelection.attempt.reasonCode ?? "NO_ELIGIBLE_MODELS",
          message:
            routingSelection.attempt.reasonMessage ??
            "No eligible models are available for this request.",
          requestId: routingTraceId,
          userMessageId: userMessage.id,
        });
        await recordBlockedUsage(options, {
          routeModel: null,
          mode: capability,
          failureCode: routingSelection.attempt.reasonCode ?? "no_eligible_models",
          occurredAt: new Date(),
          requestId: routingTraceId,
          conversationId: input.conversationId,
        });
        await recordChatAudit(options, {
          userId: input.userId,
          eventType: "chat_request_blocked",
          subjectId: input.conversationId,
          payload: {
            routingTraceId,
            reasonCode: routingSelection.attempt.reasonCode,
            routingAttemptId: routingSelection.attempt.id,
          },
        });
        await markIdempotencyCompleted(options, input, idempotencyKey, response);
        return response;
      }

      const routedCandidate = routingSelection?.model
        ? findProviderCandidateForRoute(providerCandidates, routingSelection.model)
        : null;
      if (routingSelection?.model && !routedCandidate) {
        const response = capacityBlockedResponse({
          code: "ROUTED_MODEL_UNAVAILABLE",
          message: "The selected route is not available to the provider runtime.",
          requestId: routingTraceId,
          userMessageId: userMessage.id,
        });
        await recordBlockedUsage(options, {
          routeModel: routingSelection.model,
          mode: capability,
          failureCode: "routed_model_unavailable",
          occurredAt: new Date(),
          requestId: routingTraceId,
          conversationId: input.conversationId,
        });
        await recordChatAudit(options, {
          userId: input.userId,
          eventType: "chat_request_blocked",
          subjectId: input.conversationId,
          payload: {
            routingTraceId,
            reasonCode: "routed_model_unavailable",
            registryModelId: routingSelection.model.registryModelId,
            routingAttemptId: routingSelection.attempt.id,
          },
        });
        await markIdempotencyCompleted(options, input, idempotencyKey, response);
        return response;
      }

      const rankedProviderCandidates = routedCandidate
        ? prioritizeRoutedCandidate(
            providerCandidates,
            routedCandidate,
            routingSelection?.model ?? null,
          )
        : prioritizeSelectedModel(providerCandidates, input.selectedModelId);
      const hasVisionCandidate = rankedProviderCandidates.some(
        (candidate) => candidate.supportsVision === true,
      );

      const requestDeadlineAt =
        Date.now() + (options.requestDeadlineMs ?? 90_000);
      const maxAttempts = rankedProviderCandidates.length;
      const failedModelIds = new Set<string>();
      const failedRegistryModelIds = new Set<string>();
      let lastFailedCandidate: ProviderCandidate | null = null;
      let lastFailureCode: ProviderFailureCode | null = null;
      let lastError: NormalizedProviderError | null = null;
      let forcedNextCandidate: ProviderCandidate | null = null;
      let attemptNo = 0;

      while (attemptNo < maxAttempts) {
        const cooldownMap = options.cooldownTracker?.getCooldownMap();

        const candidate =
          forcedNextCandidate ??
          selectNextModel(
            rankedProviderCandidates.map((item) => ({
              ...item,
              providerPriority: item.providerPriority ?? 1,
              modelPriority: item.modelPriority ?? 1,
            })),
            failedModelIds,
            { capability, cooldownMap, requiresVision: requestHasImage },
          );
        forcedNextCandidate = null;

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
            await recordUsageForCandidate(options, {
              candidate,
              mode: capability,
              status: "blocked",
              usedFallback: attemptNo > 0,
              failureCode: "context_too_large",
              latencyMs: null,
              usage: null,
              occurredAt: new Date(),
              requestId: routingTraceId,
              conversationId: input.conversationId,
            });
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
            const legacyModelId = getCandidateLegacyModelId(candidate);
            await options.recordProviderAttempt?.({
              conversationId: input.conversationId,
              routingTraceId,
              providerId: candidate.providerId,
              modelId: legacyModelId,
              registryModelId: getCandidateRegistryModelId(candidate),
              attemptNo,
              status: "failed",
              failureCode: "provider_rate_limited",
              startedAt: now,
              endedAt: now,
            });
            await recordUsageForCandidate(options, {
              candidate,
              mode: capability,
              status: "failed",
              usedFallback: attemptNo > 1,
              failureCode: "provider_rate_limited",
              latencyMs: 0,
              usage: null,
              occurredAt: now,
              requestId: routingTraceId,
              conversationId: input.conversationId,
            });
            failedModelIds.add(candidate.modelId);
            addFailedRegistryModelId(failedRegistryModelIds, candidate);
            lastFailedCandidate = candidate;
            lastFailureCode = "provider_rate_limited";
            lastError = normalizeProviderFailure({
              failureCode: "provider_rate_limited",
              modelId: candidate.modelId,
              providerName: candidate.providerName,
              retryAfterMs: modelRateResult.retryAfterMs,
            });
            forcedNextCandidate = await selectFallbackCandidate({
              options,
              rankedProviderCandidates,
              failedRegistryModelIds,
              mode: capability,
              input,
              requestId: routingTraceId,
              attemptNo,
              routingAttemptId: routingSelection?.attempt.id ?? null,
              failureCode: "provider_rate_limited",
              failureMessage: lastError.message,
            });
            if (
              options.modelFallbackService &&
              failedRegistryModelIds.size > 0 &&
              !forcedNextCandidate
            ) {
              break;
            }
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
          const legacyModelId = getCandidateLegacyModelId(candidate);
          await options.recordProviderAttempt?.({
            conversationId: input.conversationId,
            routingTraceId,
            providerId: candidate.providerId,
            modelId: legacyModelId,
            registryModelId: getCandidateRegistryModelId(candidate),
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
          if (legacyModelId) {
            await options.onProviderSuccess?.({
              modelId: legacyModelId,
              usage: result.usage,
            });
          }
          await recordUsageForCandidate(options, {
            candidate,
            mode: capability,
            status: "success",
            usedFallback: attemptNo > 1,
            failureCode: null,
            latencyMs,
            usage: result.usage ?? null,
            occurredAt: endedAt,
            requestId: routingTraceId,
            conversationId: input.conversationId,
          });

          const assistantMessage = await options.conversationRepository.appendMessage({
            conversationId: input.conversationId,
            role: "assistant",
            content: [{ type: "text", text: result.text }],
            providerId: candidate.providerId,
            modelId: legacyModelId,
            registryModelId: getCandidateRegistryModelId(candidate),
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
          await recordChatAudit(options, {
            userId: input.userId,
            eventType: "chat_request_completed",
            subjectId: input.conversationId,
            payload: {
              routingTraceId,
              routingAttemptId: routingSelection?.attempt.id ?? null,
              providerId: candidate.providerId,
              modelId: candidate.modelId,
              registryModelId: getCandidateRegistryModelId(candidate),
              attemptNo,
              fallbackUsed: attemptNo > 1,
              usageCounts: toUsageCounts(result.usage ?? null),
            },
          });
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

        const legacyModelId = getCandidateLegacyModelId(candidate);
        await options.recordProviderAttempt?.({
          conversationId: input.conversationId,
          routingTraceId,
          providerId: candidate.providerId,
          modelId: legacyModelId,
          registryModelId: getCandidateRegistryModelId(candidate),
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
        if (legacyModelId) {
          await options.onProviderFailure?.({
            modelId: legacyModelId,
            failureCode: normalizedFailureCode,
            retryAfterSeconds: result.retryAfterSeconds,
          });
        }
        await recordUsageForCandidate(options, {
          candidate,
          mode: capability,
          status: "failed",
          usedFallback: attemptNo > 1,
          failureCode: normalizedFailureCode,
          latencyMs,
          usage: null,
          occurredAt: endedAt,
          requestId: routingTraceId,
          conversationId: input.conversationId,
        });

        // Mark cooldown on the global tracker
        options.cooldownTracker?.markCooldown(candidate.modelId, normalizedFailureCode);

        failedModelIds.add(candidate.modelId);
        addFailedRegistryModelId(failedRegistryModelIds, candidate);
        lastFailedCandidate = candidate;
        lastFailureCode = normalizedFailureCode;
        lastError = normalizedError;

        if (!normalizedError.retryable) {
          break;
        }
        forcedNextCandidate = await selectFallbackCandidate({
          options,
          rankedProviderCandidates,
          failedRegistryModelIds,
          mode: capability,
          input,
          requestId: routingTraceId,
          attemptNo,
          routingAttemptId: routingSelection?.attempt.id ?? null,
          failureCode: normalizedFailureCode,
          failureMessage: normalizedError.message,
        });
        if (
          options.modelFallbackService &&
          failedRegistryModelIds.size > 0 &&
          !forcedNextCandidate
        ) {
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
      await recordChatAudit(options, {
        userId: input.userId,
        eventType: "chat_request_failed",
        subjectId: input.conversationId,
        payload: {
          routingTraceId,
          routingAttemptId: routingSelection?.attempt.id ?? null,
          reasonCode: exhaustedError.code,
          failedModelCount: failedModelIds.size,
        },
      });
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

async function selectInitialChatRoute(input: {
  options: CreateChatServiceOptions;
  input: Parameters<ChatService["sendMessage"]>[0];
  mode: "chat" | "agent";
  requestId: string;
  estimatedInputTokens: number;
}) {
  if (!input.options.modelRoutingService) return null;
  return input.options.modelRoutingService.selectRoute({
    mode: input.mode,
    userId: input.input.userId,
    conversationId: input.input.conversationId,
    companionAvailable: input.mode === "agent" && Boolean(input.input.workspaceId),
    estimatedInputTokens: input.estimatedInputTokens,
    preferredRegistryModelId: input.input.selectedModelId?.startsWith("mreg_")
      ? input.input.selectedModelId
      : null,
    requestId: input.requestId,
  });
}

async function selectFallbackCandidate(input: {
  options: CreateChatServiceOptions;
  rankedProviderCandidates: ProviderCandidate[];
  failedRegistryModelIds: Set<string>;
  mode: "chat" | "agent";
  input: Parameters<ChatService["sendMessage"]>[0];
  requestId: string;
  attemptNo: number;
  routingAttemptId: string | null;
  failureCode: string;
  failureMessage: string | null;
}) {
  if (!input.options.modelFallbackService || input.failedRegistryModelIds.size === 0) {
    return null;
  }

  const fallback = await input.options.modelFallbackService.selectFallback({
    mode: input.mode,
    userId: input.input.userId,
    conversationId: input.input.conversationId,
    requestId: `${input.requestId}_fb_${input.attemptNo}`,
    failedRoutingAttemptId: input.routingAttemptId,
    failedRegistryModelIds: Array.from(input.failedRegistryModelIds),
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
    companionAvailable: input.mode === "agent" && Boolean(input.input.workspaceId),
    estimatedInputTokens: estimateMessageTokens(input.input.content),
  });

  if (fallback.exhausted || !fallback.model) return null;
  const candidate = findProviderCandidateForRoute(
    input.rankedProviderCandidates,
    fallback.model,
  );
  return candidate
    ? {
        ...candidate,
        registryModelId: fallback.model.registryModelId,
        catalogModelId: fallback.model.catalogModelId,
      }
    : null;
}

function findProviderCandidateForRoute(
  candidates: ProviderCandidate[],
  model: EligibleModelCandidate,
) {
  return candidates.find((candidate) => {
    if (candidate.registryModelId === model.registryModelId) return true;
    if (candidate.catalogModelId === model.catalogModelId) return true;
    if (candidate.modelId === model.registryModelId) return true;
    if (candidate.modelId === model.catalogModelId) return true;
    return (
      candidate.providerId === model.providerId &&
      candidate.externalModelKey === model.externalModelKey
    );
  }) ?? null;
}

function prioritizeRoutedCandidate(
  candidates: ProviderCandidate[],
  routedCandidate: ProviderCandidate,
  routedModel: EligibleModelCandidate | null,
) {
  return [
    {
      ...routedCandidate,
      registryModelId: routedModel?.registryModelId ?? routedCandidate.registryModelId,
      catalogModelId: routedModel?.catalogModelId ?? routedCandidate.catalogModelId,
      providerPriority: 0,
      modelPriority: 0,
    },
    ...candidates.filter((candidate) => candidate.modelId !== routedCandidate.modelId),
  ];
}

async function recordUsageForCandidate(
  options: CreateChatServiceOptions,
  input: {
    candidate: ProviderCandidate;
    mode: "chat" | "agent";
    status: "success" | "failed" | "blocked";
    usedFallback: boolean;
    failureCode: string | null;
    latencyMs: number | null;
    usage: ProviderUsage | null;
    occurredAt: Date;
    requestId: string;
    conversationId: string;
  },
) {
  const registryModelId = getCandidateRegistryModelId(input.candidate);
  if (!options.modelUsageService || !registryModelId) return;
  try {
    await options.modelUsageService.recordUsage({
      registryModelId,
      providerId: input.candidate.providerId,
      mode: input.mode,
      status: input.status,
      usedFallback: input.usedFallback,
      failureCode: input.failureCode,
      latencyMs: input.latencyMs,
      inputTokens: input.usage?.inputTokens ?? 0,
      outputTokens: input.usage?.outputTokens ?? 0,
      totalTokens: input.usage?.totalTokens ?? 0,
      costUsdMicros: 0,
      occurredAt: input.occurredAt,
    });
  } catch (error) {
    options.logIntegrationError?.({
      event: "chat.model_usage_record_failed",
      requestId: input.requestId,
      conversationId: input.conversationId,
      error,
    });
  }
}

async function recordBlockedUsage(
  options: CreateChatServiceOptions,
  input: {
    routeModel: EligibleModelCandidate | null;
    mode: "chat" | "agent";
    failureCode: string;
    occurredAt: Date;
    requestId: string;
    conversationId: string;
  },
) {
  if (!options.modelUsageService || !input.routeModel) return;
  try {
    await options.modelUsageService.recordUsage({
      registryModelId: input.routeModel.registryModelId,
      providerId: input.routeModel.providerId,
      mode: input.mode,
      status: "blocked",
      usedFallback: false,
      failureCode: input.failureCode,
      latencyMs: null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsdMicros: 0,
      occurredAt: input.occurredAt,
    });
  } catch (error) {
    options.logIntegrationError?.({
      event: "chat.model_usage_record_failed",
      requestId: input.requestId,
      conversationId: input.conversationId,
      error,
    });
  }
}

async function recordChatAudit(
  options: CreateChatServiceOptions,
  input: {
    userId: string;
    eventType: string;
    subjectId: string;
    payload: Record<string, unknown>;
  },
) {
  try {
    await options.auditService?.recordEvent({
      userId: input.userId,
      eventType: input.eventType,
      subjectType: "conversation",
      subjectId: input.subjectId,
      payload: input.payload,
    });
  } catch (error) {
    options.logIntegrationError?.({
      event: "chat.audit_record_failed",
      requestId:
        typeof input.payload.routingTraceId === "string"
          ? input.payload.routingTraceId
          : undefined,
      conversationId: input.subjectId,
      error,
    });
  }
}

function addFailedRegistryModelId(
  failedRegistryModelIds: Set<string>,
  candidate: ProviderCandidate,
) {
  const registryModelId = getCandidateRegistryModelId(candidate);
  if (registryModelId) failedRegistryModelIds.add(registryModelId);
}

function getCandidateRegistryModelId(candidate: ProviderCandidate) {
  if (candidate.registryModelId) return candidate.registryModelId;
  return candidate.modelId.startsWith("mreg_") ? candidate.modelId : null;
}

function getCandidateLegacyModelId(candidate: ProviderCandidate) {
  if (candidate.legacyModelId !== undefined) return candidate.legacyModelId;
  return candidate.modelId.startsWith("mreg_") ? null : candidate.modelId;
}

function estimateMessageTokens(content: MessageContent[]) {
  const textLength = content
    .filter((item) => item.type === "text")
    .reduce((total, item) => total + item.text.length, 0);
  const imageTokenEstimate = content.filter((item) => item.type === "image").length * 256;
  return Math.ceil(textLength / 4) + imageTokenEstimate;
}

function toUsageCounts(usage: ProviderUsage | null) {
  return {
    input: usage?.inputTokens ?? 0,
    output: usage?.outputTokens ?? 0,
    total: usage?.totalTokens ?? 0,
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
  userMessageId?: string;
}): SendMessageResponse {
  const response = {
    userMessage: {
      id: input.userMessageId ?? "",
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
    registryModelId: message.registryModelId,
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
