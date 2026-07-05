import { and, desc, eq, max } from "drizzle-orm";
import { generateId } from "@clm/shared-utils";
import { getDb } from "../../db/connection.js";
import { conversations, messages } from "../../db/schema.js";

export interface ConversationRecord {
  id: string;
  userId: string;
  mode: "chat";
  title: string;
  archived: boolean;
  lastMessageAt: string | null;
  updatedAt: string;
}

export interface ConversationRepository {
  listForUser(userId: string): Promise<ConversationRecord[]>;
  createForUser(userId: string, title: string): Promise<ConversationRecord>;
  findForUser(userId: string, conversationId: string): Promise<ConversationRecord | null>;
  listMessages(conversationId: string): Promise<MessageRecord[]>;
  appendMessage(input: AppendMessageInput): Promise<MessageRecord>;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool" | "status";
  content: Array<{
    type: "text";
    text: string;
  }>;
  providerId: string | null;
  modelId: string | null;
  createdAt: string;
}

export interface AppendMessageInput {
  conversationId: string;
  role: MessageRecord["role"];
  content: MessageRecord["content"];
  providerId?: string | null;
  modelId?: string | null;
}

export function createInMemoryConversationRepository(): ConversationRepository {
  const items: ConversationRecord[] = [];
  const messageItems: MessageRecord[] = [];

  return {
    async listForUser(userId) {
      return items
        .filter((item) => item.userId === userId && !item.archived)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async createForUser(userId, title) {
      const now = new Date().toISOString();
      const created: ConversationRecord = {
        id: generateId("conversation"),
        userId,
        mode: "chat",
        title,
        archived: false,
        lastMessageAt: null,
        updatedAt: now,
      };

      items.unshift(created);
      return created;
    },
    async findForUser(userId, conversationId) {
      return (
        items.find((item) => item.userId === userId && item.id === conversationId) ??
        null
      );
    },
    async listMessages(conversationId) {
      return messageItems.filter((item) => item.conversationId === conversationId);
    },
    async appendMessage(input) {
      const createdAt = new Date().toISOString();
      const message: MessageRecord = {
        id: generateId("message"),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        providerId: input.providerId ?? null,
        modelId: input.modelId ?? null,
        createdAt,
      };

      messageItems.push(message);

      const conversation = items.find((item) => item.id === input.conversationId);
      if (conversation) {
        conversation.lastMessageAt = createdAt;
        conversation.updatedAt = createdAt;
      }

      return message;
    },
  };
}

export function createDatabaseConversationRepository(): ConversationRepository {
  return {
    async listForUser(userId) {
      const db = getDb();

      const rows = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.userId, userId), eq(conversations.archived, false)))
        .orderBy(desc(conversations.updatedAt));

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        mode: row.mode as "chat",
        title: row.title,
        archived: row.archived,
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async createForUser(userId, title) {
      const db = getDb();
      const conversationId = generateId("conversation");

      await db.insert(conversations).values({
        id: conversationId,
        userId,
        mode: "chat",
        title,
      });

      const inserted = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });

      if (!inserted) {
        throw new Error("Conversation was not created");
      }

      return {
        id: inserted.id,
        userId: inserted.userId,
        mode: inserted.mode as "chat",
        title: inserted.title,
        archived: inserted.archived,
        lastMessageAt: inserted.lastMessageAt?.toISOString() ?? null,
        updatedAt: inserted.updatedAt.toISOString(),
      };
    },
    async findForUser(userId, conversationId) {
      const db = getDb();

      const row = await db.query.conversations.findFirst({
        where: and(eq(conversations.userId, userId), eq(conversations.id, conversationId)),
      });

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.userId,
        mode: row.mode as "chat",
        title: row.title,
        archived: row.archived,
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    async listMessages(conversationId) {
      const db = getDb();

      const rows = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: (message, helpers) => helpers.asc(message.sequenceNo),
      });

      return rows.map((row) => ({
        id: row.id,
        conversationId: row.conversationId,
        role: row.role as MessageRecord["role"],
        content: row.contentJson as MessageRecord["content"],
        providerId: row.providerId,
        modelId: row.modelId,
        createdAt: row.createdAt.toISOString(),
      }));
    },
    async appendMessage(input) {
      const db = getDb();
      const messageId = generateId("message");
      const nextSequence = await getNextSequenceNumber(input.conversationId);

      await db.insert(messages).values({
        id: messageId,
        conversationId: input.conversationId,
        role: input.role,
        contentJson: input.content,
        providerId: input.providerId ?? null,
        modelId: input.modelId ?? null,
        sequenceNo: nextSequence,
      });

      await db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, input.conversationId));

      const inserted = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
      });

      if (!inserted) {
        throw new Error("Message was not created");
      }

      return {
        id: inserted.id,
        conversationId: inserted.conversationId,
        role: inserted.role as MessageRecord["role"],
        content: inserted.contentJson as MessageRecord["content"],
        providerId: inserted.providerId,
        modelId: inserted.modelId,
        createdAt: inserted.createdAt.toISOString(),
      };
    },
  };
}

export async function getNextSequenceNumber(conversationId: string) {
  const db = getDb();

  const result = await db
    .select({
      maxSequence: max(messages.sequenceNo),
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  return (result[0]?.maxSequence ?? 0) + 1;
}
