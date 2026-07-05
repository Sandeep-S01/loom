import { describe, it, expect } from "vitest";
import { generateId, getIdPrefix } from "../src/id-gen.js";

describe("generateId", () => {
  it("generates a user ID with usr_ prefix", () => {
    const id = generateId("user");
    expect(id).toMatch(/^usr_[0-9a-f-]{36}$/);
  });

  it("generates a conversation ID with con_ prefix", () => {
    const id = generateId("conversation");
    expect(id).toMatch(/^con_[0-9a-f-]{36}$/);
  });

  it("generates a message ID with msg_ prefix", () => {
    const id = generateId("message");
    expect(id).toMatch(/^msg_[0-9a-f-]{36}$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("user")));
    expect(ids.size).toBe(100);
  });

  it("generates IDs for all entity types", () => {
    const types = [
      "user", "device", "provider", "model", "conversation",
      "message", "contextSnapshot", "workspace", "agentRun",
      "agentRunEvent", "fileOperation", "commandExecution",
      "providerAttempt", "auditEvent", "stream", "request", "pairingCode",
    ] as const;

    for (const t of types) {
      const id = generateId(t);
      expect(id).toContain("_");
      expect(id.length).toBeGreaterThan(4);
    }
  });
});

describe("getIdPrefix", () => {
  it("extracts prefix from a valid ID", () => {
    expect(getIdPrefix("con_abc-def")).toBe("con");
  });

  it("returns null for invalid IDs", () => {
    expect(getIdPrefix("nounderscore")).toBeNull();
  });
});
