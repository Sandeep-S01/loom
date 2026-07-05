import type { FastifyInstance } from "fastify";
import { badRequest } from "../../lib/http-errors.js";
import type { CompanionService } from "./service.js";

interface RegisterCompanionRoutesOptions {
  companionService: CompanionService;
}

function requireTrimmedString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(message);
  }

  return value.trim();
}

export async function registerCompanionRoutes(
  app: FastifyInstance,
  options: RegisterCompanionRoutesOptions,
) {
  app.post("/pair/start", async (request, reply) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    reply.status(201);
    return options.companionService.startPairing(request.sessionUser.id);
  });

  app.post("/pair/complete", async (request) => {
    const body =
      (request.body as
        | {
            pairingCode?: unknown;
            machineLabel?: unknown;
            machineFingerprintHash?: unknown;
          }
        | undefined) ?? {};

    return options.companionService.completePairing({
      pairingCode: requireTrimmedString(body.pairingCode, "Pairing code is required"),
      machineLabel: requireTrimmedString(body.machineLabel, "Machine label is required"),
      machineFingerprintHash: requireTrimmedString(
        body.machineFingerprintHash,
        "Machine fingerprint hash is required",
      ),
    });
  });

  app.get("/status", async (request) => {
    if (!request.sessionUser) {
      throw new Error("Session user is not available");
    }

    return options.companionService.getStatus(request.sessionUser.id);
  });
}
