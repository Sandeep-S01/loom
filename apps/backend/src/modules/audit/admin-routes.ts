import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-guard.js";
import type { AuditService } from "./interfaces.js";
import {
  assertAuditEventId,
  parseAuditEventListQuery,
} from "./validators.js";

interface RegisterAuditAdminRoutesOptions {
  auditService: AuditService;
}

export async function registerAuditAdminRoutes(
  app: FastifyInstance,
  options: RegisterAuditAdminRoutesOptions,
) {
  app.get("/audit-events", async (request) => {
    requireAdmin(request);
    return options.auditService.listEvents(
      parseAuditEventListQuery(request.query as Record<string, unknown>),
    );
  });

  app.get("/audit-events/:id", async (request) => {
    requireAdmin(request);
    const params = request.params as { id?: string };
    return options.auditService.getEvent(assertAuditEventId(params.id));
  });
}
