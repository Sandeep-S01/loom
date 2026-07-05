import { and, desc, eq } from "drizzle-orm";
import type {
  DashboardConversationItem,
  DashboardRunItem,
  DashboardWorkspaceItem,
} from "@clm/shared-types";
import { getDb } from "../../db/connection.js";
import {
  agentRuns,
  conversations,
  workspaces,
} from "../../db/schema.js";

export interface DashboardRepository {
  listRecentConversations(userId: string): Promise<DashboardConversationItem[]>;
  listRecentAgentRuns(userId: string): Promise<DashboardRunItem[]>;
  getActiveWorkspace(userId: string): Promise<DashboardWorkspaceItem | null>;
}

interface CreateInMemoryDashboardRepositoryOptions {
  sharedWorkspaces?: Array<{
    id: string;
    userId: string;
    alias: string;
    status: string;
    displayPathHint: string | null;
    lastUsedAt: string | null;
    updatedAt: string;
  }>;
}

export function createInMemoryDashboardRepository(
  options: CreateInMemoryDashboardRepositoryOptions = {},
): DashboardRepository {
  const workspaceItems = options.sharedWorkspaces ?? [];

  return {
    async listRecentConversations() {
      return [];
    },
    async listRecentAgentRuns() {
      return [];
    },
    async getActiveWorkspace(userId) {
      const workspace =
        workspaceItems
          .filter((item) => item.userId === userId && item.status === "active")
          .sort((left, right) => {
            const leftKey = left.lastUsedAt ?? left.updatedAt;
            const rightKey = right.lastUsedAt ?? right.updatedAt;
            return rightKey.localeCompare(leftKey);
          })[0] ?? null;

      if (!workspace) {
        return null;
      }

      return {
        id: workspace.id,
        alias: workspace.alias,
        status: workspace.status as DashboardWorkspaceItem["status"],
        displayPathHint: workspace.displayPathHint,
        lastUsedAt: workspace.lastUsedAt,
      };
    },
  };
}

export function createDatabaseDashboardRepository(): DashboardRepository {
  return {
    async listRecentConversations(userId) {
      const db = getDb();
      const rows = await db
        .select({
          id: conversations.id,
          mode: conversations.mode,
          title: conversations.title,
          lastMessageAt: conversations.lastMessageAt,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .where(and(eq(conversations.userId, userId), eq(conversations.archived, false)))
        .orderBy(desc(conversations.updatedAt))
        .limit(5);

      return rows.map((row) => ({
        id: row.id,
        mode: row.mode as DashboardConversationItem["mode"],
        title: row.title,
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async listRecentAgentRuns(userId) {
      const db = getDb();
      const rows = await db
        .select({
          id: agentRuns.id,
          conversationId: agentRuns.conversationId,
          workspaceId: agentRuns.workspaceId,
          objective: agentRuns.objective,
          status: agentRuns.status,
          createdAt: agentRuns.createdAt,
          updatedAt: agentRuns.updatedAt,
        })
        .from(agentRuns)
        .innerJoin(workspaces, eq(agentRuns.workspaceId, workspaces.id))
        .where(eq(workspaces.userId, userId))
        .orderBy(desc(agentRuns.updatedAt))
        .limit(5);

      return rows.map((row) => ({
        id: row.id,
        conversationId: row.conversationId,
        workspaceId: row.workspaceId,
        objective: row.objective,
        status: row.status as DashboardRunItem["status"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async getActiveWorkspace(userId) {
      const db = getDb();
      const row = await db.query.workspaces.findFirst({
        where: and(eq(workspaces.userId, userId), eq(workspaces.status, "active")),
        orderBy: (workspace, helpers) => [
          helpers.desc(workspace.lastUsedAt),
          helpers.desc(workspace.updatedAt),
        ],
      });

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        alias: row.alias,
        status: row.status as DashboardWorkspaceItem["status"],
        displayPathHint: row.displayPathHint,
        lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      };
    },
  };
}
