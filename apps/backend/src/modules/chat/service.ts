import type { SendMessageResponse } from "@clm/shared-types";
import { notFound } from "../../lib/http-errors.js";
import type {
  ConversationRepository,
  MessageRecord,
} from "../conversations/repository.js";
import type { CooldownTracker } from "../providers/cooldown-tracker.js";
import { selectNextModel, type ModelCapability } from "../providers/router.js";
import type {
  ProviderFailureCode,
  ProviderInvocationResult,
} from "../providers/types.js";

export interface ProviderCandidate {
  providerId: string;
  modelId: string;
  modelName: string;
  externalModelKey?: string;
  baseType?: string;
  providerPriority?: number;
  modelPriority?: number;
  supportsChat?: boolean;
  supportsAgent?: boolean;
}

export type ProviderInvoker = (
  candidate: ProviderCandidate,
  history: MessageRecord[],
) => Promise<ProviderInvocationResult>;

export interface ChatService {
  sendMessage(input: {
    userId: string;
    conversationId: string;
    mode?: "chat" | "agent";
    content: Array<{
      type: "text";
      text: string;
    }>;
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
    providerId: string;
    modelId: string;
    attemptNo: number;
    status: "success" | "failed";
    failureCode?: ProviderFailureCode;
    startedAt: Date;
    endedAt: Date;
  }) => Promise<void>;
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

      const userMessage = await options.conversationRepository.appendMessage({
        conversationId: input.conversationId,
        role: "user",
        content: input.content,
      });

      const history = await options.conversationRepository.listMessages(
        input.conversationId,
      );
      const providerCandidates =
        options.providerCandidates ?? (await options.getProviderCandidates?.()) ?? [];

      const capability: ModelCapability = input.mode === "agent" ? "agent" : "chat";
      const maxAttempts = providerCandidates.length;
      const failedModelIds = new Set<string>();
      let lastFailedCandidate: ProviderCandidate | null = null;
      let lastFailureCode: ProviderFailureCode | null = null;
      let attemptNo = 0;

      while (attemptNo < maxAttempts) {
        const cooldownMap = options.cooldownTracker?.getCooldownMap();

        const candidate = selectNextModel(
          providerCandidates.map((item) => ({
            ...item,
            providerPriority: item.providerPriority ?? 1,
            modelPriority: item.modelPriority ?? 1,
          })),
          failedModelIds,
          { capability, cooldownMap },
        );

        if (!candidate) {
          break;
        }

        attemptNo += 1;
        const startedAt = new Date();
        const result = await options.invokeProvider(candidate, history);
        const endedAt = new Date();

        if (result.ok) {
          await options.recordProviderAttempt?.({
            conversationId: input.conversationId,
            providerId: candidate.providerId,
            modelId: candidate.modelId,
            attemptNo,
            status: "success",
            startedAt,
            endedAt,
          });

          const assistantMessage = await options.conversationRepository.appendMessage({
            conversationId: input.conversationId,
            role: "assistant",
            content: [{ type: "text", text: result.text }],
            providerId: candidate.providerId,
            modelId: candidate.modelId,
          });

          return {
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
            capacityBlocked: false,
          };
        }

        await options.recordProviderAttempt?.({
          conversationId: input.conversationId,
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          attemptNo,
          status: "failed",
          failureCode: result.failureCode,
          startedAt,
          endedAt,
        });

        // Mark cooldown on the global tracker
        options.cooldownTracker?.markCooldown(candidate.modelId, result.failureCode);

        failedModelIds.add(candidate.modelId);
        lastFailedCandidate = candidate;
        lastFailureCode = result.failureCode;
      }

      // All candidates exhausted or maxAttempts reached
      return {
        userMessage: {
          id: userMessage.id,
          role: "user",
        },
        assistantMessage: null,
        provider: null,
        providerSwitched: null,
        capacityBlocked: true,
        error: {
          code: "CAPACITY_EXHAUSTED",
          message: "All currently configured free models are unavailable.",
        },
      };
    },
  };
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
