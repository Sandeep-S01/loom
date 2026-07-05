import { and, desc, eq } from "drizzle-orm";
import { generateId } from "@clm/shared-utils";
import type {
  SelectWorkspaceRequest,
  SelectWorkspaceResponse,
  WorkspaceListItem,
} from "@clm/shared-types";
import { getDb } from "../../db/connection.js";
import { auditEvents, devices, workspaces } from "../../db/schema.js";
import { badRequest } from "../../lib/http-errors.js";
import type { CompanionDeviceRecord } from "../companion/repository.js";

const DESKTOP_COMPANION_DEVICE_TYPE = "desktop_companion";
const ACTIVE_WORKSPACE_STATUS = "active";
const UNKNOWN_MACHINE_ERROR = "Workspace machine is not paired for this user";

export interface WorkspaceRecord {
  id: string;
  userId: string;
  machineId: string;
  alias: string;
  canonicalPathHash: string;
  displayPathHint: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface WorkspacesRepository {
  listForUser(userId: string): Promise<WorkspaceListItem[]>;
  selectWorkspace(
    userId: string,
    input: SelectWorkspaceRequest,
  ): Promise<SelectWorkspaceResponse>;
}

export interface CreateInMemoryWorkspacesRepositoryOptions {
  now?: () => Date;
  sharedDevices?: CompanionDeviceRecord[];
  sharedWorkspaces?: WorkspaceRecord[];
  initialState?: {
    devices?: CompanionDeviceRecord[];
    workspaces?: WorkspaceRecord[];
  };
}

export interface CreateDatabaseWorkspacesRepositoryOptions {
  now?: () => Date;
}

function resolveNow(now?: () => Date) {
  return now ?? (() => new Date());
}

function toWorkspaceListItem(record: WorkspaceRecord): WorkspaceListItem {
  return {
    id: record.id,
    alias: record.alias,
    machineId: record.machineId,
    status: record.status,
    displayPathHint: record.displayPathHint,
  };
}

function sortWorkspacesNewestFirst(left: WorkspaceRecord, right: WorkspaceRecord) {
  const leftKey = left.lastUsedAt ?? left.updatedAt;
  const rightKey = right.lastUsedAt ?? right.updatedAt;
  return rightKey.localeCompare(leftKey);
}

function isKnownMachineForUser(
  device: CompanionDeviceRecord | null,
  userId: string,
  machineId: string,
) {
  if (!device) {
    throw badRequest(UNKNOWN_MACHINE_ERROR);
  }

  if (
    device.userId !== userId ||
    device.id !== machineId ||
    device.deviceType !== DESKTOP_COMPANION_DEVICE_TYPE
  ) {
    throw badRequest(UNKNOWN_MACHINE_ERROR);
  }
}

export function createInMemoryWorkspacesRepository(
  options: CreateInMemoryWorkspacesRepositoryOptions = {},
): WorkspacesRepository {
  const now = resolveNow(options.now);
  const deviceItems =
    options.sharedDevices ??
    (options.initialState?.devices ?? []).map((device) => ({
      ...device,
    }));
  const workspaceItems =
    options.sharedWorkspaces ??
    (options.initialState?.workspaces ?? []).map((workspace) => ({
      ...workspace,
    }));

  return {
    async listForUser(userId) {
      return workspaceItems
        .filter((item) => item.userId === userId)
        .sort(sortWorkspacesNewestFirst)
        .map(toWorkspaceListItem);
    },
    async selectWorkspace(userId, input) {
      const device = deviceItems.find((item) => item.id === input.machineId) ?? null;
      isKnownMachineForUser(device, userId, input.machineId);

      const currentTime = now().toISOString();
      let workspace =
        workspaceItems.find(
          (item) =>
            item.userId === userId &&
            item.machineId === input.machineId &&
            item.canonicalPathHash === input.canonicalPathHash,
        ) ?? null;

      if (workspace) {
        workspace.alias = input.alias;
        workspace.displayPathHint = input.displayPathHint ?? null;
        workspace.status = ACTIVE_WORKSPACE_STATUS;
        workspace.updatedAt = currentTime;
        workspace.lastUsedAt = currentTime;
      } else {
        workspace = {
          id: generateId("workspace"),
          userId,
          machineId: input.machineId,
          alias: input.alias,
          canonicalPathHash: input.canonicalPathHash,
          displayPathHint: input.displayPathHint ?? null,
          status: ACTIVE_WORKSPACE_STATUS,
          createdAt: currentTime,
          updatedAt: currentTime,
          lastUsedAt: currentTime,
        };
        workspaceItems.unshift(workspace);
      }

      return {
        workspace: toWorkspaceListItem(workspace),
      };
    },
  };
}

export function createDatabaseWorkspacesRepository(
  options: CreateDatabaseWorkspacesRepositoryOptions = {},
): WorkspacesRepository {
  const now = resolveNow(options.now);

  return {
    async listForUser(userId) {
      const db = getDb();
      const rows = await db.query.workspaces.findMany({
        where: eq(workspaces.userId, userId),
        orderBy: (workspace, helpers) => [
          helpers.desc(workspace.lastUsedAt),
          helpers.desc(workspace.updatedAt),
        ],
      });

      return rows.map((row) =>
        toWorkspaceListItem({
          id: row.id,
          userId: row.userId,
          machineId: row.deviceId,
          alias: row.alias,
          canonicalPathHash: row.canonicalPathHash,
          displayPathHint: row.displayPathHint,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
        }),
      );
    },
    async selectWorkspace(userId, input) {
      const db = getDb();
      const currentTime = now();

      const machine = await db.query.devices.findFirst({
        where: and(
          eq(devices.id, input.machineId),
          eq(devices.userId, userId),
          eq(devices.deviceType, DESKTOP_COMPANION_DEVICE_TYPE),
        ),
        orderBy: [desc(devices.createdAt)],
      });

      if (!machine) {
        throw badRequest(UNKNOWN_MACHINE_ERROR);
      }

      const workspaceId = await db.transaction(async (tx) => {
        const nextWorkspaceId = generateId("workspace");
        const insertedRows = await tx
          .insert(workspaces)
          .values({
            id: nextWorkspaceId,
            userId,
            deviceId: input.machineId,
            alias: input.alias,
            canonicalPathHash: input.canonicalPathHash,
            displayPathHint: input.displayPathHint ?? null,
            status: ACTIVE_WORKSPACE_STATUS,
            lastUsedAt: currentTime,
            createdAt: currentTime,
            updatedAt: currentTime,
          })
          .onConflictDoUpdate({
            target: [
              workspaces.userId,
              workspaces.deviceId,
              workspaces.canonicalPathHash,
            ],
            set: {
              alias: input.alias,
              displayPathHint: input.displayPathHint ?? null,
              status: ACTIVE_WORKSPACE_STATUS,
              lastUsedAt: currentTime,
              updatedAt: currentTime,
            },
          })
          .returning({
            id: workspaces.id,
          });

        const resolvedWorkspaceId = insertedRows[0]?.id;

        if (!resolvedWorkspaceId) {
          throw new Error("Workspace was not created");
        }

        await tx.insert(auditEvents).values({
          id: generateId("auditEvent"),
          userId,
          deviceId: input.machineId,
          eventType: "workspace_selected",
          subjectType: "workspace",
          subjectId: resolvedWorkspaceId,
          payloadJson: {
            alias: input.alias,
            canonicalPathHash: input.canonicalPathHash,
            displayPathHint: input.displayPathHint ?? null,
          },
          createdAt: currentTime,
        });

        return resolvedWorkspaceId;
      });

      const selectedWorkspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      });

      if (!selectedWorkspace) {
        throw new Error("Workspace was not created");
      }

      return {
        workspace: toWorkspaceListItem({
          id: selectedWorkspace.id,
          userId: selectedWorkspace.userId,
          machineId: selectedWorkspace.deviceId,
          alias: selectedWorkspace.alias,
          canonicalPathHash: selectedWorkspace.canonicalPathHash,
          displayPathHint: selectedWorkspace.displayPathHint,
          status: selectedWorkspace.status,
          createdAt: selectedWorkspace.createdAt.toISOString(),
          updatedAt: selectedWorkspace.updatedAt.toISOString(),
          lastUsedAt: selectedWorkspace.lastUsedAt?.toISOString() ?? null,
        }),
      };
    },
  };
}
