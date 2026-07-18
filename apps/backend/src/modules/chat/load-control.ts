import type { SendMessageResponse } from "@clm/shared-types";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/connection.js";
import { chatIdempotencyKeys } from "../../db/schema.js";
import { generateId } from "@clm/shared-utils";

export interface FixedWindowRateLimiter {
  tryConsume(input: {
    key: string;
    limit: number;
    windowMs: number;
    now?: number;
  }): { allowed: true } | { allowed: false; retryAfterMs: number };
}

export interface ConcurrencyLimiter {
  tryAcquire(input: {
    globalKey: string;
    conversationId: string;
  }): { acquired: true; release: () => void } | { acquired: false; reason: string };
}

export type ChatIdempotencyStartResult =
  | { status: "started"; requestId: string }
  | { status: "processing"; requestId: string }
  | { status: "completed"; requestId: string; response: SendMessageResponse };

export interface ChatIdempotencyStore {
  start(input: {
    userId: string;
    conversationId: string;
    idempotencyKey: string;
    requestId: string;
    expiresAt: Date;
  }): Promise<ChatIdempotencyStartResult>;
  complete(input: {
    userId: string;
    conversationId: string;
    idempotencyKey: string;
    response: SendMessageResponse;
  }): Promise<void>;
  fail(input: {
    userId: string;
    conversationId: string;
    idempotencyKey: string;
    errorCode: string;
  }): Promise<void>;
}

export function createInMemoryFixedWindowRateLimiter(): FixedWindowRateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    tryConsume({ key, limit, windowMs, now = Date.now() }) {
      if (limit <= 0) {
        return { allowed: true };
      }

      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
      }

      if (existing.count >= limit) {
        return {
          allowed: false,
          retryAfterMs: Math.max(0, existing.resetAt - now),
        };
      }

      existing.count += 1;
      return { allowed: true };
    },
  };
}

export function createInMemoryConcurrencyLimiter(input: {
  maxGlobal: number;
  maxPerConversation: number;
}): ConcurrencyLimiter {
  let globalActive = 0;
  const conversationActive = new Map<string, number>();

  return {
    tryAcquire({ conversationId }) {
      const currentConversationActive = conversationActive.get(conversationId) ?? 0;

      if (input.maxGlobal > 0 && globalActive >= input.maxGlobal) {
        return { acquired: false, reason: "global_limit" };
      }

      if (
        input.maxPerConversation > 0 &&
        currentConversationActive >= input.maxPerConversation
      ) {
        return { acquired: false, reason: "conversation_limit" };
      }

      globalActive += 1;
      conversationActive.set(conversationId, currentConversationActive + 1);

      let released = false;
      return {
        acquired: true,
        release: () => {
          if (released) {
            return;
          }

          released = true;
          globalActive = Math.max(0, globalActive - 1);
          const latestConversationActive = conversationActive.get(conversationId) ?? 0;
          if (latestConversationActive <= 1) {
            conversationActive.delete(conversationId);
          } else {
            conversationActive.set(conversationId, latestConversationActive - 1);
          }
        },
      };
    },
  };
}

export function createInMemoryChatIdempotencyStore(): ChatIdempotencyStore {
  const rows = new Map<
    string,
    {
      status: "processing" | "completed" | "failed";
      requestId: string;
      response?: SendMessageResponse;
      expiresAt: number;
    }
  >();

  return {
    async start(input) {
      const key = getIdempotencyKey(input);
      const existing = rows.get(key);
      const now = Date.now();

      if (existing && existing.expiresAt > now) {
        if (existing.status === "completed" && existing.response) {
          return {
            status: "completed",
            requestId: existing.requestId,
            response: existing.response,
          };
        }

        if (existing.status === "processing") {
          return { status: "processing", requestId: existing.requestId };
        }
      }

      rows.set(key, {
        status: "processing",
        requestId: input.requestId,
        expiresAt: input.expiresAt.getTime(),
      });
      return { status: "started", requestId: input.requestId };
    },
    async complete(input) {
      const key = getIdempotencyKey(input);
      const existing = rows.get(key);
      rows.set(key, {
        status: "completed",
        requestId: existing?.requestId ?? input.response.routingTraceId ?? "",
        response: input.response,
        expiresAt: existing?.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
      });
    },
    async fail(input) {
      const key = getIdempotencyKey(input);
      const existing = rows.get(key);
      rows.set(key, {
        status: "failed",
        requestId: existing?.requestId ?? "",
        expiresAt: existing?.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
      });
    },
  };
}

export function createDatabaseChatIdempotencyStore(): ChatIdempotencyStore {
  return {
    async start(input) {
      const db = getDb();
      const inserted = await db
        .insert(chatIdempotencyKeys)
        .values({
          id: generateId("request"),
          userId: input.userId,
          conversationId: input.conversationId,
          idempotencyKey: input.idempotencyKey,
          status: "processing",
          requestId: input.requestId,
          expiresAt: input.expiresAt,
        })
        .onConflictDoNothing({
          target: [
            chatIdempotencyKeys.userId,
            chatIdempotencyKeys.conversationId,
            chatIdempotencyKeys.idempotencyKey,
          ],
        })
        .returning();

      if (inserted[0]) {
        return { status: "started", requestId: input.requestId };
      }

      const existing = await db.query.chatIdempotencyKeys.findFirst({
        where: and(
          eq(chatIdempotencyKeys.userId, input.userId),
          eq(chatIdempotencyKeys.conversationId, input.conversationId),
          eq(chatIdempotencyKeys.idempotencyKey, input.idempotencyKey),
        ),
      });

      if (!existing || existing.expiresAt.getTime() <= Date.now()) {
        await db
          .update(chatIdempotencyKeys)
          .set({
            status: "processing",
            requestId: input.requestId,
            responseJson: null,
            errorCode: null,
            expiresAt: input.expiresAt,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(chatIdempotencyKeys.userId, input.userId),
              eq(chatIdempotencyKeys.conversationId, input.conversationId),
              eq(chatIdempotencyKeys.idempotencyKey, input.idempotencyKey),
            ),
          );

        return { status: "started", requestId: input.requestId };
      }

      if (existing.status === "completed" && existing.responseJson) {
        return {
          status: "completed",
          requestId: existing.requestId,
          response: existing.responseJson as SendMessageResponse,
        };
      }

      if (existing.status === "processing") {
        return { status: "processing", requestId: existing.requestId };
      }

      await db
        .update(chatIdempotencyKeys)
        .set({
          status: "processing",
          requestId: input.requestId,
          responseJson: null,
          errorCode: null,
          expiresAt: input.expiresAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chatIdempotencyKeys.userId, input.userId),
            eq(chatIdempotencyKeys.conversationId, input.conversationId),
            eq(chatIdempotencyKeys.idempotencyKey, input.idempotencyKey),
          ),
        );

      return { status: "started", requestId: input.requestId };
    },
    async complete(input) {
      const db = getDb();
      await db
        .update(chatIdempotencyKeys)
        .set({
          status: "completed",
          responseJson: input.response,
          errorCode: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chatIdempotencyKeys.userId, input.userId),
            eq(chatIdempotencyKeys.conversationId, input.conversationId),
            eq(chatIdempotencyKeys.idempotencyKey, input.idempotencyKey),
          ),
        );
    },
    async fail(input) {
      const db = getDb();
      await db
        .update(chatIdempotencyKeys)
        .set({
          status: "failed",
          errorCode: input.errorCode,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chatIdempotencyKeys.userId, input.userId),
            eq(chatIdempotencyKeys.conversationId, input.conversationId),
            eq(chatIdempotencyKeys.idempotencyKey, input.idempotencyKey),
          ),
        );
    },
  };
}

function getIdempotencyKey(input: {
  userId: string;
  conversationId: string;
  idempotencyKey: string;
}) {
  return `${input.userId}:${input.conversationId}:${input.idempotencyKey}`;
}
