import { describe, expect, it } from "vitest";
import { createInMemoryAuditEventRepository } from "./repository.js";
import { createAuditService } from "./service.js";

describe("audit service", () => {
  it("records append-only audit events", async () => {
    const service = createAuditService({
      repository: createInMemoryAuditEventRepository(),
    });

    const event = await service.recordEvent({
      userId: "usr_1",
      deviceId: "dev_1",
      eventType: "provider_updated",
      subjectType: "provider",
      subjectId: "prov_1",
      payload: { changedFields: ["displayName"] },
      createdAt: new Date("2026-07-19T10:00:00.000Z"),
    });

    expect(event).toMatchObject({
      userId: "usr_1",
      deviceId: "dev_1",
      eventType: "provider_updated",
      subjectType: "provider",
      subjectId: "prov_1",
      payload: { changedFields: ["displayName"] },
      createdAt: new Date("2026-07-19T10:00:00.000Z"),
    });
  });

  it("lists events with pagination and filters", async () => {
    const repository = createInMemoryAuditEventRepository();
    const service = createAuditService({ repository });
    await service.recordEvent(makeEvent({ eventType: "session_login" }));
    await service.recordEvent(makeEvent({ eventType: "workspace_selected" }));

    const result = await service.listEvents({
      eventType: "workspace_selected",
      page: 1,
      pageSize: 10,
      sort: "createdAt",
      direction: "desc",
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      eventType: "workspace_selected",
      createdAt: "2026-07-19T10:00:00.000Z",
    });
  });

  it("gets an event by id", async () => {
    const repository = createInMemoryAuditEventRepository();
    const service = createAuditService({ repository });
    const created = await service.recordEvent(makeEvent());

    const result = await service.getEvent(created.id);

    expect(result.event).toMatchObject({
      id: created.id,
      userId: "usr_1",
      eventType: "session_login",
    });
  });

  it("rejects secret-like payload keys", async () => {
    const service = createAuditService({
      repository: createInMemoryAuditEventRepository(),
    });

    await expect(
      service.recordEvent(makeEvent({ payload: { apiKey: "sk-hidden" } })),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
    });
  });

  it("returns not found for missing events", async () => {
    const service = createAuditService({
      repository: createInMemoryAuditEventRepository(),
    });

    await expect(service.getEvent("aud_missing")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });
});

function makeEvent(input: {
  eventType?: string;
  payload?: Record<string, unknown> | null;
} = {}) {
  return {
    userId: "usr_1",
    deviceId: null,
    eventType: input.eventType ?? "session_login",
    subjectType: "user",
    subjectId: "usr_1",
    payload: "payload" in input ? input.payload : null,
    createdAt: new Date("2026-07-19T10:00:00.000Z"),
  };
}
