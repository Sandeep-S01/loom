import { randomUUID } from "node:crypto";
import { badRequest, conflict } from "../../lib/http-errors.js";
import type {
  EligibleModelCandidate,
  EligibilityReason,
} from "../model-eligibility/domain.js";
import type { ModelEligibilityService } from "../model-eligibility/interfaces.js";
import type {
  FallbackDecisionDTO,
  FallbackDecisionRecord,
  FallbackSelection,
  SelectFallbackInput,
} from "./domain.js";
import type {
  FallbackDecisionRepository,
  ModelFallbackLogger,
  ModelFallbackService,
} from "./interfaces.js";

interface CreateModelFallbackServiceOptions {
  eligibilityService: ModelEligibilityService;
  decisionRepository: FallbackDecisionRepository;
  logger?: ModelFallbackLogger;
}

const noopLogger: ModelFallbackLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelFallbackService(
  options: CreateModelFallbackServiceOptions,
): ModelFallbackService {
  const logger = options.logger ?? noopLogger;

  return {
    async selectFallback(input) {
      const failedModelIds = normalizeFailedModelIds(input.failedRegistryModelIds);
      const requestId = input.requestId ?? `fallback_${randomUUID()}`;
      const existing = await options.decisionRepository.findByRequestId(requestId);
      if (existing) {
        throw conflict("Fallback request has already been recorded.");
      }

      const eligibility = await options.eligibilityService.evaluate({
        mode: input.mode,
        purpose: "routing",
        companionAvailable: input.companionAvailable,
        estimatedInputTokens: input.estimatedInputTokens,
        requestedOutputTokens: input.requestedOutputTokens,
        includeIneligible: true,
      });

      const failedModelIdSet = new Set(failedModelIds);
      const selected =
        eligibility.eligible.find(
          (candidate) => !failedModelIdSet.has(candidate.registryModelId),
        ) ?? null;
      const skippedFailedCount = eligibility.eligible.filter((candidate) =>
        failedModelIdSet.has(candidate.registryModelId),
      ).length;
      const exhaustedReason = selected
        ? null
        : getExhaustedReason(eligibility.ineligible.flatMap((model) => model.reasons));

      const decision = await createDecisionOrThrowConflict(() =>
        options.decisionRepository.create({
          requestId,
          userId: input.userId,
          conversationId: input.conversationId ?? null,
          agentRunId: input.agentRunId ?? null,
          mode: input.mode,
          failedRoutingAttemptId: input.failedRoutingAttemptId ?? null,
          failedRegistryModelIds: failedModelIds,
          selectedRegistryModelId: selected?.registryModelId ?? null,
          status: selected ? "fallback_selected" : "exhausted",
          failureCode: input.failureCode,
          failureMessage: input.failureMessage ?? null,
          eligibleCount: eligibility.eligible.length,
          skippedFailedCount,
          reasonCode: exhaustedReason?.code ?? null,
          reasonMessage: exhaustedReason?.message ?? null,
          metadata: {
            estimatedInputTokens: input.estimatedInputTokens ?? null,
            requestedOutputTokens: input.requestedOutputTokens ?? null,
            companionAvailable: input.companionAvailable,
          },
        }),
      );

      logger.info(
        {
          event: "model_fallback.decision_recorded",
          requestId,
          mode: input.mode,
          status: decision.status,
          selectedRegistryModelId: decision.selectedRegistryModelId,
          failedModelCount: failedModelIds.length,
          eligibleCount: decision.eligibleCount,
        },
        "Model fallback decision recorded",
      );

      return toFallbackSelection(decision, selected);
    },

    async listDecisions(filters) {
      const result = await options.decisionRepository.list(filters);
      return {
        items: result.items.map(mapFallbackDecisionRecord),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasNextPage: result.hasNextPage,
      };
    },
  };
}

export function mapFallbackDecisionRecord(
  record: FallbackDecisionRecord,
): FallbackDecisionDTO {
  return {
    id: record.id,
    requestId: record.requestId,
    userId: record.userId,
    conversationId: record.conversationId,
    agentRunId: record.agentRunId,
    mode: record.mode,
    failedRoutingAttemptId: record.failedRoutingAttemptId,
    failedRegistryModelIds: record.failedRegistryModelIds,
    selectedRegistryModelId: record.selectedRegistryModelId,
    status: record.status,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    eligibleCount: record.eligibleCount,
    skippedFailedCount: record.skippedFailedCount,
    reasonCode: record.reasonCode,
    reasonMessage: record.reasonMessage,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
  };
}

function toFallbackSelection(
  decision: FallbackDecisionRecord,
  model: EligibleModelCandidate | null,
): FallbackSelection {
  if (model) {
    return {
      decision: mapFallbackDecisionRecord(decision),
      model,
      exhausted: false,
    };
  }
  return {
    decision: mapFallbackDecisionRecord(decision),
    model: null,
    exhausted: true,
  };
}

function normalizeFailedModelIds(registryModelIds: string[]) {
  const ids = Array.from(
    new Set(registryModelIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (ids.length === 0) {
    throw badRequest("At least one failed registry model id is required.");
  }
  return ids;
}

function getExhaustedReason(reasons: EligibilityReason[]) {
  return (
    reasons.find((reason) => reason.code !== "eligible") ?? {
      code: "fallback_exhausted",
      message: "No remaining eligible fallback model is available.",
    }
  );
}

async function createDecisionOrThrowConflict(
  createDecision: () => Promise<FallbackDecisionRecord>,
) {
  try {
    return await createDecision();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Fallback request has already been recorded.");
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
