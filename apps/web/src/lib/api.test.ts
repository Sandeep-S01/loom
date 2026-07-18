import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createConversation,
  deleteConversation,
  listAvailableModels,
  login,
  logout,
  renameConversation,
  startPairing,
} from "./api";

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

  it("posts login credentials to the session endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: "usr_seeded",
          displayName: "Primary User",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await login({
      email: "user@clm.local",
      password: "changeme",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toContain("/api/v1/session/login");
    expect(init.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(
      JSON.stringify({
        email: "user@clm.local",
        password: "changeme",
      }),
    );
  });

  it("posts logout without a JSON content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    });

    vi.stubGlobal("fetch", fetchMock);

    await logout();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toContain("/api/v1/session/logout");
    expect(init.method).toBe("POST");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("uses PATCH with a JSON body when renaming a conversation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        conversation: {
          id: "con_test",
          mode: "chat",
          title: "Renamed Thread",
          lastMessageAt: null,
          updatedAt: "2026-07-06T12:00:00.000Z",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await renameConversation("con_test", "Renamed Thread");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toContain("/api/v1/conversations/con_test");
    expect(init.method).toBe("PATCH");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ title: "Renamed Thread" }));
  });

  it("uses DELETE without a JSON content type when deleting a conversation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    vi.stubGlobal("fetch", fetchMock);

    await deleteConversation("con_test");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toContain("/api/v1/conversations/con_test");
    expect(init.method).toBe("DELETE");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("loads selector models from the model registry endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await listAvailableModels("chat");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/models/selector?mode=chat");
  });
});
