import type { FastifyInstance } from "fastify";
import { badRequest } from "../../lib/http-errors.js";
import type { WorkspacesService } from "./service.js";

interface RegisterWorkspacesRoutesOptions {
  workspacesService: WorkspacesService;
}

function requireTrimmedString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(message);
  }

  return value.trim();
}

function getOptionalTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function registerWorkspacesRoutes(
  app: FastifyInstance,
  options: RegisterWorkspacesRoutesOptions,
) {
  app.get("/", async (request) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    return options.workspacesService.listForUser(request.sessionUser.id);
  });

  app.post("/select", async (request) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    const body =
      (request.body as
        | {
            machineId?: unknown;
            alias?: unknown;
            canonicalPathHash?: unknown;
            displayPathHint?: unknown;
          }
        | undefined) ?? {};

    return options.workspacesService.selectWorkspace(request.sessionUser.id, {
      machineId: requireTrimmedString(body.machineId, "Workspace machine ID is required"),
      alias: requireTrimmedString(body.alias, "Workspace alias is required"),
      canonicalPathHash: requireTrimmedString(
        body.canonicalPathHash,
        "Workspace canonical path hash is required",
      ),
      displayPathHint: getOptionalTrimmedString(body.displayPathHint),
    });
  });
}
