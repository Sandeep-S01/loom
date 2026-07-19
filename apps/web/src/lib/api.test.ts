import { afterEach, describe, expect, it, vi } from "vitest";
import {
  archiveAdminRegistryModel,
  checkAdminProviderCredential,
  createConversation,
  deleteConversation,
  getOptionalSession,
  getAdminModelUsageSummary,
  listAdminModelCatalog,
  listAdminModelUsageCounters,
  listAdminModelRuntimeHealth,
  listAdminProviders,
  listAdminProviderHealth,
  listAdminRoutingAttempts,
  listAvailableModels,
  login,
  logout,
  renameConversation,
  registerAdminCatalogModel,
  resetAdminModelRuntimeHealth,
  resetAdminProviderHealth,
  runAdminDiscoveryJob,
  startPairing,
  updateAdminProvider,
  upsertAdminModelPolicy,
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

  it("loads optional session state without throwing on no-content responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("No body");
      },
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(getOptionalSession()).resolves.toBeNull();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/session?optional=true");
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

  it("sends the CSRF token header for unsafe browser requests", async () => {
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
    vi.stubGlobal("document", {
      cookie: "loom_csrf=csrf_test_token",
    });

    await renameConversation("con_test", "Renamed Thread");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get("x-csrf-token")).toBe("csrf_test_token");
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

  it("loads admin providers with filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        hasNextPage: false,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await listAdminProviders({
      status: "active",
      search: "openrouter",
      pageSize: 50,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/providers");
    expect(url).toContain("status=active");
    expect(url).toContain("search=openrouter");
    expect(url).toContain("pageSize=50");
  });

  it("updates admin provider secret references with PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "prv_openrouter",
        name: "OpenRouter",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await updateAdminProvider("prv_openrouter", {
      defaultSecretRef: "OPENROUTER_API_KEY",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/providers/prv_openrouter");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(
      JSON.stringify({ defaultSecretRef: "OPENROUTER_API_KEY" }),
    );
  });

  it("checks provider credentials without exposing secret values", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "cred_openrouter",
        providerId: "prv_openrouter",
        secretRef: "OPENROUTER_API_KEY",
        status: "configured",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await checkAdminProviderCredential({ providerId: "prv_openrouter" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/provider-credentials/check");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ providerId: "prv_openrouter" }));
  });

  it("runs provider discovery as a manual admin job", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "disc_1",
        providerId: "prv_openrouter",
        status: "succeeded",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await runAdminDiscoveryJob("prv_openrouter");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/discovery/jobs");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ providerId: "prv_openrouter", triggerType: "manual" }),
    );
  });

  it("loads discovered admin catalog models with filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        hasNextPage: false,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await listAdminModelCatalog({
      providerId: "prv_openrouter",
      capability: "chat",
      costTier: "free",
      pageSize: 50,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/model-catalog");
    expect(url).toContain("providerId=prv_openrouter");
    expect(url).toContain("capability=chat");
    expect(url).toContain("costTier=free");
    expect(url).toContain("pageSize=50");
  });

  it("approves catalog models into the admin registry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "mreg_test",
        catalogModelId: "mcat_test",
        status: "registered",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await registerAdminCatalogModel({
      catalogModelId: "mcat_test",
      notes: "Approved for chat",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/model-registry");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ catalogModelId: "mcat_test", notes: "Approved for chat" }),
    );
  });

  it("archives approved registry models", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "mreg_test",
        status: "archived",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await archiveAdminRegistryModel("mreg_test", "No longer needed");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/model-registry/mreg_test");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBe(JSON.stringify({ archiveReason: "No longer needed" }));
  });

  it("saves model policy for approved registry models", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "mpol_test",
        registryModelId: "mreg_test",
        enabled: true,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await upsertAdminModelPolicy("mreg_test", {
      enabled: true,
      visibleInSelector: true,
      priorityRank: 10,
      defaultForChat: false,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/model-policy/mreg_test");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(
      JSON.stringify({
        enabled: true,
        visibleInSelector: true,
        priorityRank: 10,
        defaultForChat: false,
      }),
    );
  });

  it("loads model runtime health records", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        hasNextPage: false,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await listAdminModelRuntimeHealth({
      status: "open_circuit",
      pageSize: 100,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/model-runtime-health");
    expect(url).toContain("status=open_circuit");
    expect(url).toContain("pageSize=100");
  });

  it("resets model runtime health", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        registryModelId: "mreg_test",
        status: "healthy",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await resetAdminModelRuntimeHealth("mreg_test");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/model-runtime-health/mreg_test/reset");
    expect(init.method).toBe("POST");
  });

  it("loads provider health records", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        hasNextPage: false,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await listAdminProviderHealth({
      status: "degraded",
      pageSize: 100,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/provider-health");
    expect(url).toContain("status=degraded");
    expect(url).toContain("pageSize=100");
  });

  it("resets provider health", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        providerId: "prv_openrouter",
        status: "healthy",
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await resetAdminProviderHealth("prv_openrouter");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/provider-health/prv_openrouter/reset");
    expect(init.method).toBe("POST");
  });

  it("loads routing attempts from the routing module endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        hasNextPage: false,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await listAdminRoutingAttempts({
      status: "selected",
      mode: "chat",
      pageSize: 50,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/routing-attempts");
    expect(url).toContain("status=selected");
    expect(url).toContain("mode=chat");
    expect(url).toContain("pageSize=50");
  });

  it("loads admin model usage summary", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await getAdminModelUsageSummary({
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-02T00:00:00.000Z",
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/model-usage/summary");
    expect(url).toContain("from=2026-07-01T00%3A00%3A00.000Z");
    expect(url).toContain("to=2026-07-02T00%3A00%3A00.000Z");
  });

  it("loads admin model usage counters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        page: 1,
        pageSize: 25,
        total: 0,
        hasNextPage: false,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    await listAdminModelUsageCounters({
      providerId: "prov_1",
      granularity: "day",
      sort: "totalTokens",
      direction: "desc",
      pageSize: 50,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/model-usage/counters");
    expect(url).toContain("providerId=prov_1");
    expect(url).toContain("granularity=day");
    expect(url).toContain("sort=totalTokens");
    expect(url).toContain("direction=desc");
    expect(url).toContain("pageSize=50");
  });
});
