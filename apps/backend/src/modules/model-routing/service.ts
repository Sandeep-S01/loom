import { randomUUID } from "node:crypto";
import { conflict } from "../../lib/http-errors.js";
import type {
  EligibleModelCandidate,
  EligibilityReason,
} from "../model-eligibility/domain.js";
import type { ModelEligibilityService } from "../model-eligibility/interfaces.js";
import type {
  ModelRouteSelection,
  RoutingAttemptDTO,
  RoutingAttemptRecord,
  SelectModelRouteInput,
} from "./domain.js";
import type {
  ModelRoutingLogger,
  ModelRoutingService,
  RoutingAttemptRepository,
} from "./interfaces.js";

interface CreateModelRoutingServiceOptions {
  eligibilityService: ModelEligibilityService;
  attemptRepository: RoutingAttemptRepository;
  logger?: ModelRoutingLogger;
}

const noopLogger: ModelRoutingLogger = {
  info() {},
  warn() {},
  error() {},
};

export function createModelRoutingService(
  options: CreateModelRoutingServiceOptions,
): ModelRoutingService {
  const logger = options.logger ?? noopLogger;

  return {
    async selectRoute(input) {
      const requestId = input.requestId ?? `route_${randomUUID()}`;
      const existing = await options.attemptRepository.findByRequestId(requestId);
      if (existing) {
        throw conflict("Routing request has already been recorded.");
      }

      const eligibility = await options.eligibilityService.evaluate({
        mode: input.mode,
        purpose: "routing",
        companionAvailable: input.companionAvailable,
        estimatedInputTokens: input.estimatedInputTokens,
        requestedOutputTokens: input.requestedOutputTokens,
        includeIneligible: true,
      });
      const selected = eligibility.eligible[0] ?? null;
      const noEligibleReason = selected
        ? null
        : getNoEligibleReason(eligibility.ineligible.flatMap((model) => model.reasons));

      const attempt = await createAttemptOrThrowConflict(() =>
        options.attemptRepository.create({
          requestId,
          userId: input.userId,
          conversationId: input.conversationId ?? null,
          agentRunId: input.agentRunId ?? null,
          mode: input.mode,
          registryModelId: selected?.registryModelId ?? null,
          status: selected ? "selected" : "no_eligible_models",
          eligibleCount: eligibility.eligible.length,
          ineligibleCount: eligibility.ineligible.length,
          reasonCode: noEligibleReason?.code ?? null,
          reasonMessage: noEligibleReason?.message ?? null,
          metadata: {
            estimatedInputTokens: input.estimatedInputTokens ?? null,
            requestedOutputTokens: input.requestedOutputTokens ?? null,
            companionAvailable: input.companionAvailable,
          },
        }),
      );

      logger.info(
        {
          event: "model_routing.route_selected",
          requestId,
          mode: input.mode,
          status: attempt.status,
          registryModelId: attempt.registryModelId,
          eligibleCount: attempt.eligibleCount,
          ineligibleCount: attempt.ineligibleCount,
        },
        "Model route selection recorded",
      );

      return toRouteSelection(attempt, selected);
    },

    async listAttempts(filters) {
      const result = await options.attemptRepository.list(filters);
      return {
        items: result.items.map(mapRoutingAttemptRecord),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasNextPage: result.hasNextPage,
      };
    },
  };
}

export function mapRoutingAttemptRecord(
  record: RoutingAttemptRecord,
): RoutingAttemptDTO {
  return {
    id: record.id,
    requestId: record.requestId,
    userId: record.userId,
    conversationId: record.conversationId,
    agentRunId: record.agentRunId,
    mode: record.mode,
    registryModelId: record.registryModelId,
    status: record.status,
    eligibleCount: record.eligibleCount,
    ineligibleCount: record.ineligibleCount,
    reasonCode: record.reasonCode,
    reasonMessage: record.reasonMessage,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
  };
}

function toRouteSelection(
  attempt: RoutingAttemptRecord,
  model: EligibleModelCandidate | null,
): ModelRouteSelection {
  return {
    attempt: mapRoutingAttemptRecord(attempt),
    model,
    eligibleCount: attempt.eligibleCount,
    ineligibleCount: attempt.ineligibleCount,
  };
}

function getNoEligibleReason(reasons: EligibilityReason[]) {
  return (
    reasons.find((reason) => reason.code !== "eligible") ?? {
      code: "no_eligible_models",
      message: "No eligible models are available for this request.",
    }
  );
}

async function createAttemptOrThrowConflict(
  createAttempt: () => Promise<RoutingAttemptRecord>,
) {
  try {
    return await createAttempt();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Routing request has already been recorded.");
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
