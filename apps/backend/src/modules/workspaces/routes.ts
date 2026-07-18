import type { FastifyInstance } from "fastify";
import { badRequest, unauthorized } from "../../lib/http-errors.js";
import type { CompanionService } from "../companion/service.js";
import type { WorkspacesService } from "./service.js";

interface RegisterWorkspacesRoutesOptions {
  workspacesService: WorkspacesService;
  companionService: CompanionService;
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
    const body =
      (request.body as
        | {
            machineId?: unknown;
            alias?: unknown;
            canonicalPathHash?: unknown;
            displayPathHint?: unknown;
          }
        | undefined) ?? {};
    const machineId = requireTrimmedString(body.machineId, "Workspace machine ID is required");
    const userId =
      request.sessionUser?.id ??
      (await resolveCompanionUserId(options.companionService, request.headers.authorization, machineId));

    return options.workspacesService.selectWorkspace(userId, {
      machineId,
      alias: requireTrimmedString(body.alias, "Workspace alias is required"),
      canonicalPathHash: requireTrimmedString(
        body.canonicalPathHash,
        "Workspace canonical path hash is required",
      ),
      displayPathHint: getOptionalTrimmedString(body.displayPathHint),
    });
  });
}

async function resolveCompanionUserId(
  companionService: CompanionService,
  authorizationHeader: string | undefined,
  machineId: string,
) {
  const token = getBearerToken(authorizationHeader);
  if (!token) {
    throw unauthorized("Authentication required.");
  }

  const session = await companionService.resolveMachineSession({
    deviceId: machineId,
    machineSessionToken: token,
  });

  return session.userId;
}

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}
