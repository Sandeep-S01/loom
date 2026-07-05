import { afterEach, describe, expect, it, vi } from "vitest";
import { createConversation, startPairing } from "./api";

describe("api request helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits the JSON content type for bodyless pairing requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pairingCode: "pair_test",
        expiresAt: "2026-07-05T18:20:00.000Z",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await startPairing();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(init.method).toBe("POST");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("sets the JSON content type when a request body is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        conversationId: "con_test",
        mode: "chat",
        title: "Draft",
        updatedAt: "2026-07-05T18:20:00.000Z",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await createConversation({ mode: "chat", title: "Draft" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
