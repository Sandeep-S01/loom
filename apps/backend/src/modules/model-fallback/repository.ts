import { randomUUID } from "node:crypto";
import type {
  CreateFallbackDecisionInput,
  FallbackDecisionListFilters,
  FallbackDecisionRecord,
  PaginatedFallbackDecisionResult,
} from "./domain.js";
import type { FallbackDecisionRepository } from "./interfaces.js";

export function createInMemoryFallbackDecisionRepository(
  seed: FallbackDecisionRecord[] = [],
): FallbackDecisionRepository {
  // Fallback has no finalized database table yet. Keep this repository explicit and
  // swappable so the service boundary can become durable without changing callers.
  const rowsById = new Map(seed.map((row) => [row.id, row]));
  const idsByRequestId = new Map(seed.map((row) => [row.requestId, row.id]));

  return {
    async list(filters) {
      return paginateDecisions(Array.from(rowsById.values()), filters);
    },

    async findByRequestId(requestId) {
      return (
        Array.from(rowsById.values()).find((row) => row.requestId === requestId) ??
        null
      );
    },

    async create(input) {
      if (idsByRequestId.has(input.requestId)) {
        throw Object.assign(new Error("Duplicate fallback request id."), {
          code: "23505",
        });
      }
      const record: FallbackDecisionRecord = {
        id: `fdec_${randomUUID()}`,
        requestId: input.requestId,
        userId: input.userId,
        conversationId: input.conversationId,
        agentRunId: input.agentRunId,
        mode: input.mode,
        failedRoutingAttemptId: input.failedRoutingAttemptId,
        failedRegistryModelIds: [...input.failedRegistryModelIds],
        selectedRegistryModelId: input.selectedRegistryModelId,
        status: input.status,
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
        eligibleCount: input.eligibleCount,
        skippedFailedCount: input.skippedFailedCount,
        reasonCode: input.reasonCode,
        reasonMessage: input.reasonMessage,
        metadata: input.metadata,
        createdAt: new Date(),
      };
      rowsById.set(record.id, record);
      idsByRequestId.set(record.requestId, record.id);
      return record;
    },
  };
}

function paginateDecisions(
  rows: FallbackDecisionRecord[],
  filters: FallbackDecisionListFilters,
): PaginatedFallbackDecisionResult {
  const filtered = rows.filter((row) => {
    if (filters.userId && row.userId !== filters.userId) return false;
    if (filters.conversationId && row.conversationId !== filters.conversationId) {
      return false;
    }
    if (filters.agentRunId && row.agentRunId !== filters.agentRunId) return false;
    if (
      filters.selectedRegistryModelId &&
      row.selectedRegistryModelId !== filters.selectedRegistryModelId
    ) {
      return false;
    }
    if (filters.status && row.status !== filters.status) return false;
    if (filters.mode && row.mode !== filters.mode) return false;
    return true;
  });
  const sorted = [...filtered].sort((left, right) => {
    const modifier = filters.direction === "asc" ? 1 : -1;
    return (left.createdAt.getTime() - right.createdAt.getTime()) * modifier;
  });
  const offset = (filters.page - 1) * filters.pageSize;
  const items = sorted.slice(offset, offset + filters.pageSize);
  return {
    items,
    page: filters.page,
    pageSize: filters.pageSize,
    total: filtered.length,
    hasNextPage: offset + items.length < filtered.length,
  };
}
