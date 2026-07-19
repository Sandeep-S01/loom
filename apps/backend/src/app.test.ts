import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { createInMemoryCompanionRepository } from "./modules/companion/repository.js";
import { createCompanionService } from "./modules/companion/service.js";
import { createInMemoryWorkspacesRepository } from "./modules/workspaces/repository.js";
import { createWorkspacesService } from "./modules/workspaces/service.js";
import { createInMemoryModelRegistryService } from "./modules/models/service.js";
import type { ModelRegistryApprovalService } from "./modules/model-registry/interfaces.js";
import type { ModelPolicyService } from "./modules/model-policy/interfaces.js";
import type { ModelEligibilityService } from "./modules/model-eligibility/interfaces.js";
import type { ModelRuntimeHealthService } from "./modules/model-runtime-health/interfaces.js";
import type { SessionService } from "./modules/session/service.js";
import { SESSION_COOKIE_NAME } from "./plugins/session.js";

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }

  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.METRICS_ENABLED;
  delete process.env.METRICS_TOKEN;
  vi.useRealTimers();
});

describe("operational metrics", () => {
  it("does not expose the metrics endpoint when collection is disabled", async () => {
    app = buildApp();

    const response = await app.inject({ method: "GET", url: "/metrics" });

    expect(response.statusCode).toBe(404);
  });

  it("requires the dedicated bearer token and exports bounded route labels", async () => {
    process.env.METRICS_ENABLED = "true";
    process.env.METRICS_TOKEN = "metrics-token-with-at-least-32-characters";
    app = buildApp();

    const unauthorized = await app.inject({ method: "GET", url: "/metrics" });
    expect(unauthorized.statusCode).toBe(401);

    await app.inject({ method: "GET", url: "/api/v1/health/live?request=unique-value" });
    const response = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: `Bearer ${process.env.METRICS_TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.body).toContain("loom_http_requests_total");
    expect(response.body).toContain('route="/api/v1/health/live"');
    expect(response.body).not.toContain("unique-value");
  });
});

describe("session bootstrap", () => {
  it("returns health diagnostics without exposing provider secrets", async () => {
    process.env.OPENROUTER_API_KEY = "sk-openrouter-health-secret";
    process.env.GEMINI_API_KEY = "gemini-health-secret";
    app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    const body = response.body;
    expect(response.statusCode).toBe(200);
    expect(body).not.toContain("sk-openrouter-health-secret");
    expect(body).not.toContain("gemini-health-secret");
    expect(body).not.toContain("OPENROUTER_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
  });

  it("keeps liveness healthy while readiness reports dependency failures", async () => {
    app = buildApp({
      readinessProbe: async () => ({
        database: "unavailable",
        redis: "ok",
      }),
    });

    const liveResponse = await app.inject({
      method: "GET",
      url: "/api/v1/health/live",
    });
    const readyResponse = await app.inject({
      method: "GET",
      url: "/api/v1/health/ready",
    });

    expect(liveResponse.statusCode).toBe(200);
    expect(liveResponse.json().status).toBe("ok");
    expect(readyResponse.statusCode).toBe(503);
    expect(readyResponse.json()).toMatchObject({
      status: "unavailable",
      database: { status: "unavailable" },
      redis: { status: "ok" },
    });
  });

  it("returns the seeded single user", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/session",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: "usr_seeded",
        displayName: "Primary User",
        email: "user@clm.local",
        role: "admin",
      },
    });
  }, 10000);

  it("rejects session bootstrap when no authenticated session exists", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/session",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
        requestId: expect.any(String),
      },
    });
  });

  it("creates a session cookie for valid credentials", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/session/login",
      payload: {
        email: "user@clm.local",
        password: "changeme",
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toEqual({
      user: {
        id: "usr_seeded",
        displayName: "Primary User",
        email: "user@clm.local",
        role: "admin",
      },
    });
    expect(loginResponse.cookies).toEqual([
      expect.objectContaining({
        name: SESSION_COOKIE_NAME,
        httpOnly: true,
        sameSite: "Lax",
      }),
      expect.anything(),
    ]);
    const sessionToken = loginResponse.cookies.find(
      (cookie) => cookie.name === SESSION_COOKIE_NAME,
    )?.value;
    expect(sessionToken).toBe("session_admin");
    expect(sessionToken).not.toBe("usr_seeded");

    const sessionResponse = await app.inject({
      method: "GET",
      url: "/api/v1/session",
      cookies: {
        [SESSION_COOKIE_NAME]: sessionToken!,
      },
    });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json().user.id).toBe("usr_seeded");
  });

  it("rejects invalid login credentials", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/session/login",
      payload: {
        email: "user@clm.local",
        password: "wrong-password",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid email or password.",
        requestId: expect.any(String),
      },
    });
  });

  it("registers a customer account and creates a session cookie", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/session/register",
      payload: {
        email: "new.customer@example.com",
        password: "strongpass",
        displayName: "New Customer",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: "usr_registered",
        displayName: "New Customer",
        email: "new.customer@example.com",
        role: "customer",
      },
    });
    expect(response.cookies).toContainEqual(
      expect.objectContaining({
        name: SESSION_COOKIE_NAME,
        httpOnly: true,
        sameSite: "Lax",
      }),
    );
  });

  it("rejects weak registration passwords", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/session/register",
      payload: {
        email: "new.customer@example.com",
        password: "short",
        displayName: "New Customer",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toBe(
      "Password must be at least 8 characters.",
    );
  });

  it("does not accept a raw user id as an authenticated session token", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/session",
      cookies: {
        [SESSION_COOKIE_NAME]: "usr_seeded",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rate limits repeated login failures", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/session/login",
        payload: {
          email: "user@clm.local",
          password: `wrong-${attempt}`,
        },
      });
      expect(response.statusCode).toBe(401);
    }

    const blockedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/session/login",
      payload: {
        email: "user@clm.local",
        password: "still-wrong",
      },
    });

    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.json().error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("rejects untrusted mutation origins in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousFrontendUrl = process.env.FRONTEND_URL;
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "https://loom.example";

    try {
      app = buildApp({
        sessionService: createStrictTestSessionService(),
      });

      const blockedResponse = await app.inject({
        method: "POST",
        url: "/api/v1/session/login",
        payload: {
          email: "user@clm.local",
          password: "changeme",
        },
      });
      expect(blockedResponse.statusCode).toBe(403);

      const trustedResponse = await app.inject({
        method: "POST",
        url: "/api/v1/session/login",
        headers: {
          origin: "https://loom.example",
        },
        payload: {
          email: "user@clm.local",
          password: "changeme",
        },
      });
      expect(trustedResponse.statusCode).toBe(200);
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousFrontendUrl === undefined) {
        delete process.env.FRONTEND_URL;
      } else {
        process.env.FRONTEND_URL = previousFrontendUrl;
      }
    }
  });

  it("clears the session cookie on logout", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/session/login",
      payload: {
        email: "user@clm.local",
        password: "changeme",
      },
    });
    const sessionToken = loginResponse.cookies.find(
      (cookie) => cookie.name === SESSION_COOKIE_NAME,
    )?.value;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/session/logout",
      cookies: {
        [SESSION_COOKIE_NAME]: sessionToken!,
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.cookies).toEqual([
      expect.objectContaining({
        name: SESSION_COOKIE_NAME,
        value: "",
      }),
      expect.anything(),
    ]);

    const revokedResponse = await app.inject({
      method: "GET",
      url: "/api/v1/session",
      cookies: {
        [SESSION_COOKIE_NAME]: sessionToken!,
      },
    });
    expect(revokedResponse.statusCode).toBe(401);
  });

  it("updates the authenticated session profile", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/session",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_admin",
      },
      payload: {
        displayName: "Sandeep Singh",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: "usr_seeded",
        displayName: "Sandeep Singh",
        email: "user@clm.local",
        role: "admin",
      },
    });
  });
});

function createStrictTestSessionService(): SessionService {
  let displayName = "Primary User";
  let revoked = false;
  let registered = false;

  return {
    async resolveSessionUser(sessionToken) {
      if (sessionToken === "session_admin" && !revoked) {
        return {
          id: "usr_seeded",
          email: "user@clm.local",
          displayName,
          role: "admin",
        };
      }

      return null;
    },
    async authenticate(input) {
      if (
        input.email === "user@clm.local" &&
        input.password === "changeme"
      ) {
        return {
          id: "usr_seeded",
          email: "user@clm.local",
          displayName,
          role: "admin",
        };
      }

      const { unauthorized } = await import("./lib/http-errors.js");
      throw unauthorized("Invalid email or password.");
    },
    async createSession(userId) {
      if (userId !== "usr_seeded" && userId !== "usr_registered") {
        throw new Error("Unknown test user");
      }
      revoked = false;
      return {
        token: userId === "usr_registered" ? "session_registered" : "session_admin",
        expiresAt: new Date(Date.now() + 60_000),
      };
    },
    async revokeSession(sessionToken) {
      if (sessionToken === "session_admin") {
        revoked = true;
      }
    },
    async registerUser(input) {
      if (registered || input.email === "user@clm.local") {
        const { conflict } = await import("./lib/http-errors.js");
        throw conflict("An account with this email already exists.");
      }

      registered = true;
      return {
        id: "usr_registered",
        email: input.email,
        displayName: input.displayName,
        role: "customer",
      };
    },
    async updateProfile(input) {
      if (input.userId !== "usr_seeded") {
        const { unauthorized } = await import("./lib/http-errors.js");
        throw unauthorized("Authentication required.");
      }

      displayName = input.displayName;

      return {
        id: "usr_seeded",
        email: "user@clm.local",
        displayName,
        role: "admin",
      };
    },
  };
}

function createCustomerTestSessionService(): SessionService {
  return {
    async resolveSessionUser(sessionToken) {
      if (sessionToken !== "session_customer") {
        return null;
      }

      return {
        id: "usr_customer",
        email: "customer@clm.local",
        displayName: "Customer User",
        role: "customer",
      };
    },
    async authenticate() {
      return {
        id: "usr_customer",
        email: "customer@clm.local",
        displayName: "Customer User",
        role: "customer",
      };
    },
    async createSession() {
      return {
        token: "session_customer",
        expiresAt: new Date(Date.now() + 60_000),
      };
    },
    async revokeSession() {},
    async registerUser(input) {
      return {
        id: "usr_customer_registered",
        email: input.email,
        displayName: input.displayName,
        role: "customer",
      };
    },
    async updateProfile(input) {
      return {
        id: input.userId,
        email: "customer@clm.local",
        displayName: input.displayName,
        role: "customer",
      };
    },
  };
}

describe("admin route protection", () => {
  it("allows customers to use the chat selector but blocks full model registry access", async () => {
    const app = buildApp({
      sessionService: createCustomerTestSessionService(),
      modelRegistryService: createInMemoryModelRegistryService(),
    });

    const selectorResponse = await app.inject({
      method: "GET",
      url: "/api/v1/models/selector?mode=chat",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_customer",
      },
    });

    expect(selectorResponse.statusCode).toBe(200);

    const registryResponse = await app.inject({
      method: "GET",
      url: "/api/v1/models",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_customer",
      },
    });

    expect(registryResponse.statusCode).toBe(403);
    expect(registryResponse.json().error.message).toBe("Admin access required.");

    await app.close();
  });

  it("blocks customer marketplace sync mutations", async () => {
    const app = buildApp({
      sessionService: createCustomerTestSessionService(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/marketplace/free-models/sync",
      payload: {},
      cookies: {
        [SESSION_COOKIE_NAME]: "session_customer",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe("Admin access required.");

    await app.close();
  });

  it("returns paginated failover attempts to admins only", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const adminResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/failover-attempts?page=1&pageSize=10",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_admin",
      },
    });

    expect(adminResponse.statusCode).toBe(200);
    expect(adminResponse.json()).toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      hasNextPage: false,
    });
  });

  it("caps failover diagnostics page size at 100 rows", async () => {
    const modelRegistryService = createInMemoryModelRegistryService();
    const listAttemptEvents = vi.fn(async (input) => ({
      items: [],
      page: input.page,
      pageSize: input.pageSize,
      total: 0,
      hasNextPage: false,
    }));
    modelRegistryService.listAttemptEvents = listAttemptEvents;
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelRegistryService,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/failover-attempts?pageSize=100000",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(listAttemptEvents).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
  });

  it("rejects unknown model mutation fields and inverted analytics ranges", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelRegistryService: createInMemoryModelRegistryService(),
    });
    const cookies = { [SESSION_COOKIE_NAME]: "session_admin" };

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/api/v1/models/mdl_unknown",
      payload: { runtimeStatus: "healthy" },
      cookies,
    });
    const analyticsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/models/analytics?from=2026-07-11T00:00:00.000Z&to=2026-07-10T00:00:00.000Z",
      cookies,
    });

    expect(patchResponse.statusCode).toBe(400);
    expect(patchResponse.json().error.message).toContain("Unknown model field");
    expect(analyticsResponse.statusCode).toBe(400);
    expect(analyticsResponse.json().error.message).toContain("must not be after");
  });

  it("blocks customer access to failover attempts", async () => {
    const customerApp = buildApp({
      sessionService: createCustomerTestSessionService(),
    });

    const response = await customerApp.inject({
      method: "GET",
      url: "/api/v1/admin/failover-attempts",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_customer",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe("Admin access required.");

    await customerApp.close();
  });

  it("returns model catalog results to admins with parsed query filters", async () => {
    const listCatalog = vi.fn(async (filters) => ({
      items: [],
      page: filters.page,
      pageSize: filters.pageSize,
      total: 0,
      hasNextPage: false,
    }));
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelCatalogService: {
        listCatalog,
        getCatalogModel: vi.fn(),
        upsertDiscoveredModel: vi.fn(),
        upsertDiscoveredModels: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/model-catalog?pageSize=1000&capability=toolUse&costTier=free",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
      hasNextPage: false,
    });
    expect(listCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "toolUse",
        costTier: "free" as const,
        pageSize: 100,
      }),
    );
  });

  it("blocks customer access to the model catalog admin API", async () => {
    const customerApp = buildApp({
      sessionService: createCustomerTestSessionService(),
    });

    const response = await customerApp.inject({
      method: "GET",
      url: "/api/v1/admin/model-catalog",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_customer",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe("Admin access required.");

    await customerApp.close();
  });

  it("returns model registry results to admins with parsed query filters", async () => {
    const listRegistry = vi.fn(async (filters) => ({
      items: [],
      page: filters.page,
      pageSize: filters.pageSize,
      total: 0,
      hasNextPage: false,
    }));
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelRegistryApprovalService: {
        listRegistry,
        getRegistryModel: vi.fn(),
        registerCatalogModel: vi.fn(),
        archiveRegistryModel: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/model-registry?pageSize=1000&providerId=prv_openrouter&includeArchived=true",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
      hasNextPage: false,
    });
    expect(listRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "prv_openrouter",
        includeArchived: true,
        pageSize: 100,
      }),
    );
  });

  it("approves catalog models into the model registry for admins", async () => {
    const registerCatalogModel: ModelRegistryApprovalService["registerCatalogModel"] =
      vi.fn(async (input) => ({
        id: "mreg_deepseek",
        catalogModelId: input.catalogModelId,
        status: "registered" as const,
        approvedByUserId: input.actorUserId,
        approvedAt: "2026-07-19T00:00:00.000Z",
        archivedByUserId: null,
        archivedAt: null,
        archiveReason: null,
        notes: input.notes,
        catalog: {
          id: input.catalogModelId,
          providerId: "prv_openrouter",
          externalModelKey: "deepseek/deepseek-chat",
          displayName: "DeepSeek Chat",
          description: null,
          capabilities: {
            chat: true,
            agent: false,
            vision: false,
            toolUse: true,
            jsonMode: true,
          },
          contextWindow: 65_536,
          maxOutputTokens: 8_192,
          costTier: "free" as const,
          pricing: {
            inputPer1mUsdMicros: 0,
            outputPer1mUsdMicros: 0,
            currency: "USD" as const,
            raw: null,
          },
          releaseStage: "stable" as const,
          releasedAt: null,
          deprecatedAt: null,
          deprecationReason: null,
          providerMetadata: {},
          firstDiscoveredAt: "2026-07-19T00:00:00.000Z",
          lastDiscoveredAt: "2026-07-19T00:00:00.000Z",
          lastChangedAt: null,
          createdAt: "2026-07-19T00:00:00.000Z",
          updatedAt: "2026-07-19T00:00:00.000Z",
        },
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      }));
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelRegistryApprovalService: {
        listRegistry: vi.fn(),
        getRegistryModel: vi.fn(),
        registerCatalogModel,
        archiveRegistryModel: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/model-registry",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
      payload: {
        catalogModelId: "mcat_deepseek",
        notes: "Approved for launch",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(
      expect.objectContaining({
        id: "mreg_deepseek",
        catalogModelId: "mcat_deepseek",
        status: "registered",
      }),
    );
    expect(registerCatalogModel).toHaveBeenCalledWith({
      catalogModelId: "mcat_deepseek",
      notes: "Approved for launch",
      actorUserId: "usr_seeded",
    });
  });

  it("blocks customer access to the model registry admin API", async () => {
    const customerApp = buildApp({
      sessionService: createCustomerTestSessionService(),
    });

    const response = await customerApp.inject({
      method: "GET",
      url: "/api/v1/admin/model-registry",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_customer",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe("Admin access required.");

    await customerApp.close();
  });

  it("returns model policy results to admins with parsed query filters", async () => {
    const listPolicies = vi.fn(async (filters) => ({
      items: [],
      page: filters.page,
      pageSize: filters.pageSize,
      total: 0,
      hasNextPage: false,
    }));
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelPolicyService: {
        listPolicies,
        getPolicy: vi.fn(),
        upsertPolicy: vi.fn(),
        deletePolicy: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/model-policy?pageSize=1000&enabled=true&defaultsOnly=true",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
      hasNextPage: false,
    });
    expect(listPolicies).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        defaultsOnly: true,
        pageSize: 100,
      }),
    );
  });

  it("updates model policy for admins", async () => {
    const upsertPolicy: ModelPolicyService["upsertPolicy"] = vi.fn(async (input) => ({
      id: "mpol_deepseek",
      registryModelId: input.registryModelId,
      enabled: input.patch.enabled ?? true,
      visibleInSelector: input.patch.visibleInSelector ?? true,
      priorityRank: input.patch.priorityRank ?? 100,
      defaultForChat: input.patch.defaultForChat ?? false,
      defaultForAgent: input.patch.defaultForAgent ?? false,
      requiresCompanion: input.patch.requiresCompanion ?? false,
      requestsPerMinuteLimit: input.patch.requestsPerMinuteLimit ?? null,
      tokensPerDayLimit: input.patch.tokensPerDayLimit ?? null,
      tokensPerRequestLimit: input.patch.tokensPerRequestLimit ?? null,
      notes: input.patch.notes ?? null,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    }));
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelPolicyService: {
        listPolicies: vi.fn(),
        getPolicy: vi.fn(),
        upsertPolicy,
        deletePolicy: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/model-policy/mreg_deepseek",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
      payload: {
        enabled: false,
        priorityRank: 20,
        tokensPerDayLimit: 50_000,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        registryModelId: "mreg_deepseek",
        enabled: false,
        priorityRank: 20,
      }),
    );
    expect(upsertPolicy).toHaveBeenCalledWith({
      registryModelId: "mreg_deepseek",
      actorUserId: "usr_seeded",
      patch: {
        enabled: false,
        priorityRank: 20,
        tokensPerDayLimit: 50_000,
      },
    });
  });

  it("rejects invalid model policy payloads before service execution", async () => {
    const upsertPolicy = vi.fn();
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelPolicyService: {
        listPolicies: vi.fn(),
        getPolicy: vi.fn(),
        upsertPolicy,
        deletePolicy: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/model-policy/mreg_deepseek",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
      payload: {
        priorityRank: -1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(upsertPolicy).not.toHaveBeenCalled();
  });

  it("blocks customer access to the model policy admin API", async () => {
    const customerApp = buildApp({
      sessionService: createCustomerTestSessionService(),
    });

    const response = await customerApp.inject({
      method: "GET",
      url: "/api/v1/admin/model-policy",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_customer",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe("Admin access required.");

    await customerApp.close();
  });

  it("returns model runtime health results to admins with parsed query filters", async () => {
    const listRuntimeHealth = vi.fn(async (filters) => ({
      items: [],
      page: filters.page,
      pageSize: filters.pageSize,
      total: 0,
      hasNextPage: false,
    }));
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelRuntimeHealthService: {
        listRuntimeHealth,
        getRuntimeHealthModel: vi.fn(),
        upsertRuntimeHealth: vi.fn(),
        resetRuntimeHealth: vi.fn(),
        getRuntimeHealth: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/model-runtime-health?pageSize=1000&status=rate_limited",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
      hasNextPage: false,
    });
    expect(listRuntimeHealth).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rate_limited",
        pageSize: 100,
      }),
    );
  });

  it("updates model runtime health for admins", async () => {
    const upsertRuntimeHealth: ModelRuntimeHealthService["upsertRuntimeHealth"] =
      vi.fn(async (input) => ({
        id: "mrts_deepseek",
        registryModelId: input.registryModelId,
        status: input.patch.status ?? "unknown",
        cooldownUntil: input.patch.cooldownUntil?.toISOString() ?? null,
        consecutiveFailures: input.patch.consecutiveFailures ?? 0,
        lastFailureCode: input.patch.lastFailureCode ?? null,
        lastFailureAt: input.patch.lastFailureAt?.toISOString() ?? null,
        lastSuccessAt: input.patch.lastSuccessAt?.toISOString() ?? null,
        lastCheckedAt: input.patch.lastCheckedAt?.toISOString() ?? null,
        reason: input.patch.reason ?? null,
        updatedByUserId: input.actorUserId,
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      }));
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelRuntimeHealthService: {
        listRuntimeHealth: vi.fn(),
        getRuntimeHealthModel: vi.fn(),
        upsertRuntimeHealth,
        resetRuntimeHealth: vi.fn(),
        getRuntimeHealth: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/model-runtime-health/mreg_deepseek",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
      payload: {
        status: "open_circuit",
        consecutiveFailures: 4,
        cooldownUntil: "2026-07-19T01:00:00.000Z",
        reason: "Repeated timeouts",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        registryModelId: "mreg_deepseek",
        status: "open_circuit",
        consecutiveFailures: 4,
      }),
    );
    expect(upsertRuntimeHealth).toHaveBeenCalledWith({
      registryModelId: "mreg_deepseek",
      actorUserId: "usr_seeded",
      patch: {
        status: "open_circuit",
        consecutiveFailures: 4,
        cooldownUntil: new Date("2026-07-19T01:00:00.000Z"),
        reason: "Repeated timeouts",
      },
    });
  });

  it("rejects invalid model runtime health payloads before service execution", async () => {
    const upsertRuntimeHealth = vi.fn();
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelRuntimeHealthService: {
        listRuntimeHealth: vi.fn(),
        getRuntimeHealthModel: vi.fn(),
        upsertRuntimeHealth,
        resetRuntimeHealth: vi.fn(),
        getRuntimeHealth: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/model-runtime-health/mreg_deepseek",
      cookies: { [SESSION_COOKIE_NAME]: "session_admin" },
      payload: {
        status: "offline",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(upsertRuntimeHealth).not.toHaveBeenCalled();
  });

  it("blocks customer access to the model runtime health admin API", async () => {
    const customerApp = buildApp({
      sessionService: createCustomerTestSessionService(),
    });

    const response = await customerApp.inject({
      method: "GET",
      url: "/api/v1/admin/model-runtime-health",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_customer",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toBe("Admin access required.");

    await customerApp.close();
  });
});

describe("model eligibility routes", () => {
  it("returns request-time eligibility for authenticated users", async () => {
    const evaluate: ModelEligibilityService["evaluate"] = vi.fn(async (context) => ({
      mode: context.mode,
      purpose: context.purpose,
      eligible: [
        {
          registryModelId: "mreg_deepseek",
          catalogModelId: "mcat_deepseek",
          providerId: "prv_openrouter",
          providerName: "OpenRouter",
          externalModelKey: "deepseek/deepseek-chat",
          displayName: "DeepSeek Chat",
          capabilities: {
            chat: true,
            agent: false,
            vision: false,
            toolUse: true,
            jsonMode: true,
          },
          contextWindow: 65_536,
          maxOutputTokens: 8_192,
          priorityRank: 10,
          providerPriorityRank: 10,
          defaultForChat: true,
          defaultForAgent: false,
          requiresCompanion: false,
          requestsPerMinuteLimit: 60,
          tokensPerDayLimit: 100_000,
          tokensPerRequestLimit: 8_000,
          runtimeStatus: "healthy" as const,
          providerHealthStatus: "healthy" as const,
          reasons: [
            {
              code: "eligible" as const,
              message: "Model is eligible for this request.",
            },
          ],
        },
      ],
      ineligible: [],
    }));
    app = buildApp({
      sessionService: createCustomerTestSessionService(),
      modelEligibilityService: { evaluate },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/eligibility?mode=chat&purpose=selector&estimatedInputTokens=100&requestedOutputTokens=200",
      cookies: { [SESSION_COOKIE_NAME]: "session_customer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().eligible[0].registryModelId).toBe("mreg_deepseek");
    expect(evaluate).toHaveBeenCalledWith({
      mode: "chat",
      purpose: "selector",
      companionAvailable: false,
      estimatedInputTokens: 100,
      requestedOutputTokens: 200,
      includeIneligible: false,
    });
  });

  it("requires admin access for eligibility diagnostics", async () => {
    const evaluate = vi.fn();
    app = buildApp({
      sessionService: createCustomerTestSessionService(),
      modelEligibilityService: { evaluate },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/eligibility?includeIneligible=true",
      cookies: { [SESSION_COOKIE_NAME]: "session_customer" },
    });

    expect(response.statusCode).toBe(403);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("requires authentication for eligibility", async () => {
    const evaluate = vi.fn();
    app = buildApp({
      sessionService: createStrictTestSessionService(),
      modelEligibilityService: { evaluate },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/eligibility",
    });

    expect(response.statusCode).toBe(401);
    expect(evaluate).not.toHaveBeenCalled();
  });
});

describe("conversation routes", () => {
  it("rejects titles that exceed the database limit", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: { mode: "chat", title: "x".repeat(501) },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain("500 characters or fewer");
  });

  it("creates and lists chat conversations for the session user", async () => {
    app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        mode: "chat",
        title: "New Conversation",
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().conversation.mode).toBe("chat");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/conversations",
      cookies: createResponse.cookies.reduce<Record<string, string>>((acc, cookie) => {
        acc[cookie.name] = cookie.value;
        return acc;
      }, {}),
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().conversations).toHaveLength(1);
    expect(listResponse.json().conversations[0].title).toBe("New Conversation");
  });

  it("renames a conversation for the session user", async () => {
    app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        mode: "chat",
        title: "Original Conversation",
      },
    });
    const cookies = createResponse.cookies.reduce<Record<string, string>>((acc, cookie) => {
      acc[cookie.name] = cookie.value;
      return acc;
    }, {});

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/conversations/${createResponse.json().conversation.id}`,
      payload: {
        title: "Renamed Conversation",
      },
      cookies,
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toEqual({
      conversation: expect.objectContaining({
        id: createResponse.json().conversation.id,
        title: "Renamed Conversation",
      }),
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/conversations",
      cookies,
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().conversations).toEqual([
      expect.objectContaining({
        id: createResponse.json().conversation.id,
        title: "Renamed Conversation",
      }),
    ]);
  });

  it("archives a conversation so it no longer appears in the recent list", async () => {
    app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        mode: "chat",
        title: "Delete Me",
      },
    });
    const cookies = createResponse.cookies.reduce<Record<string, string>>((acc, cookie) => {
      acc[cookie.name] = cookie.value;
      return acc;
    }, {});

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/conversations/${createResponse.json().conversation.id}`,
      cookies,
    });

    expect(deleteResponse.statusCode).toBe(204);

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/conversations",
      cookies,
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().conversations).toEqual([]);
  });

  it("returns a structured 404 error for an unknown conversation", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/conversations/con_missing/messages",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Conversation not found",
        requestId: expect.any(String),
      },
    });
  });

  it("returns a structured 400 error for invalid message content", async () => {
    app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/conversations",
      payload: {
        mode: "chat",
        title: "Validation Thread",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/conversations/${createResponse.json().conversation.id}/messages`,
      payload: {
        content: [],
      },
      cookies: createResponse.cookies.reduce<Record<string, string>>((acc, cookie) => {
        acc[cookie.name] = cookie.value;
        return acc;
      }, {}),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Message content is required",
        requestId: expect.any(String),
      },
    });
  });
});

describe("dashboard routes", () => {
  it("rejects dashboard access without an authenticated session", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
        requestId: expect.any(String),
      },
    });
  });

  it("returns an empty dashboard payload for a new session", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      recentConversations: [],
      recentAgentRuns: [],
      activeWorkspace: null,
      companion: {
        connected: false,
        machineLabel: null,
      },
      providerSummary: {
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      },
    });
  });

  it("returns recent conversations ordered newest first", async () => {
    app = buildApp({
      dashboardService: {
        getDashboard: async () => ({
          recentConversations: [
            {
              id: "con_newest",
              mode: "chat",
              title: "Newest Conversation",
              lastMessageAt: "2026-07-04T09:30:00.000Z",
              updatedAt: "2026-07-04T09:30:00.000Z",
            },
            {
              id: "con_older",
              mode: "agent",
              title: "Older Conversation",
              lastMessageAt: "2026-07-04T08:15:00.000Z",
              updatedAt: "2026-07-04T08:15:00.000Z",
            },
          ],
          recentAgentRuns: [
            {
              id: "run_latest",
              conversationId: "con_newest",
              workspaceId: "ws_active",
              objective: "Investigate route coverage",
              status: "completed",
              createdAt: "2026-07-04T09:00:00.000Z",
              updatedAt: "2026-07-04T09:20:00.000Z",
            },
          ],
          activeWorkspace: {
            id: "ws_active",
            alias: "backend",
            status: "active",
            displayPathHint: "D:/Personal_Project/clm_tool",
            lastUsedAt: "2026-07-04T09:25:00.000Z",
          },
          companion: {
            connected: true,
            machineLabel: "Devbox",
          },
          providerSummary: {
            eligibleCount: 2,
            cooldownCount: 1,
            lastExhaustedAt: "2026-07-04T07:45:00.000Z",
          },
        }),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      recentConversations: [
        {
          id: "con_newest",
          mode: "chat",
          title: "Newest Conversation",
          lastMessageAt: "2026-07-04T09:30:00.000Z",
          updatedAt: "2026-07-04T09:30:00.000Z",
        },
        {
          id: "con_older",
          mode: "agent",
          title: "Older Conversation",
          lastMessageAt: "2026-07-04T08:15:00.000Z",
          updatedAt: "2026-07-04T08:15:00.000Z",
        },
      ],
      recentAgentRuns: [
        {
          id: "run_latest",
          conversationId: "con_newest",
          workspaceId: "ws_active",
          objective: "Investigate route coverage",
          status: "completed",
          createdAt: "2026-07-04T09:00:00.000Z",
          updatedAt: "2026-07-04T09:20:00.000Z",
        },
      ],
      activeWorkspace: {
        id: "ws_active",
        alias: "backend",
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
        lastUsedAt: "2026-07-04T09:25:00.000Z",
      },
      companion: {
        connected: true,
        machineLabel: "Devbox",
      },
      providerSummary: {
        eligibleCount: 2,
        cooldownCount: 1,
        lastExhaustedAt: "2026-07-04T07:45:00.000Z",
      },
    });
  });

  it("returns a structured 500 error when session user is unavailable", async () => {
    app = buildApp();
    app.addHook("preHandler", async (request) => {
      if (request.url === "/api/v1/dashboard") {
        request.sessionUser = null;
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Session user is not available",
        requestId: expect.any(String),
      },
    });
  });
});

describe("companion pairing", () => {
  it("creates a short-lived pairing challenge", async () => {
    app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      pairingCode: expect.stringMatching(/^pair_/),
      expiresAt: expect.any(String),
    });
  });

  it("rejects an expired pairing code", async () => {
    app = buildApp({
      companionService: createCompanionService({
        repository: createInMemoryCompanionRepository({
          now: () => new Date("2026-07-04T12:10:00.000Z"),
          initialState: {
            challenges: [
              {
                pairingCode: "pair_expired",
                userId: "usr_seeded",
                expiresAt: "2026-07-04T12:05:00.000Z",
                usedAt: null,
              },
            ],
          },
        }),
      }),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: "pair_expired",
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:expired",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Pairing code has expired",
        requestId: expect.any(String),
      },
    });
  });

  it("completes pairing and returns machine credentials", async () => {
    app = buildApp();

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
    });

    const completionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: startResponse.json().pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:device",
      },
    });

    expect(completionResponse.statusCode).toBe(200);
    expect(completionResponse.json()).toEqual({
      deviceId: expect.stringMatching(/^dev_/),
      machineSessionToken: expect.stringMatching(/^machine_/),
    });

    const statusResponse = await app.inject({
      method: "GET",
      url: "/api/v1/companion/status",
    });

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toEqual({
      connected: true,
      machineLabel: "Devbox",
      deviceId: completionResponse.json().deviceId,
    });
  });
});

describe("workspaces", () => {
  it("lists known workspaces for the current user", async () => {
    app = buildApp({
      workspacesService: createWorkspacesService({
        repository: createInMemoryWorkspacesRepository({
          initialState: {
            workspaces: [
              {
                id: "ws_latest",
                userId: "usr_seeded",
                machineId: "dev_seeded",
                alias: "backend",
                canonicalPathHash: "sha256:path-a",
                displayPathHint: "D:/Personal_Project/clm_tool",
                status: "active",
                createdAt: "2026-07-04T09:00:00.000Z",
                updatedAt: "2026-07-04T09:05:00.000Z",
                lastUsedAt: "2026-07-04T09:05:00.000Z",
              },
            ],
          },
        }),
      }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      workspaces: [
        {
          id: "ws_latest",
          alias: "backend",
          machineId: "dev_seeded",
          status: "active",
          displayPathHint: "D:/Personal_Project/clm_tool",
        },
      ],
    });
  });

  it("creates or updates a workspace binding", async () => {
    app = buildApp({
      workspacesService: createWorkspacesService({
        repository: createInMemoryWorkspacesRepository({
          now: () => new Date("2026-07-04T10:15:00.000Z"),
          initialState: {
            devices: [
              {
                id: "dev_seeded",
                userId: "usr_seeded",
                deviceType: "desktop_companion",
                machineLabel: "Devbox",
                machineFingerprintHash: "sha256:devbox",
                lastSeenAt: "2026-07-04T10:00:00.000Z",
                createdAt: "2026-07-04T09:00:00.000Z",
              },
            ],
            workspaces: [
              {
                id: "ws_existing",
                userId: "usr_seeded",
                machineId: "dev_seeded",
                alias: "old-name",
                canonicalPathHash: "sha256:path-a",
                displayPathHint: "D:/Old",
                status: "missing",
                createdAt: "2026-07-04T09:05:00.000Z",
                updatedAt: "2026-07-04T09:10:00.000Z",
                lastUsedAt: "2026-07-04T09:10:00.000Z",
              },
            ],
          },
        }),
      }),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/select",
      payload: {
        machineId: "dev_seeded",
        alias: "backend",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      workspace: {
        id: "ws_existing",
        alias: "backend",
        machineId: "dev_seeded",
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });
  });

  it("supports the default pair-then-select flow end-to-end", async () => {
    app = buildApp();

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
    });

    const pairResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: startResponse.json().pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:device",
      },
    });

    const selectResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/select",
      payload: {
        machineId: pairResponse.json().deviceId,
        alias: "backend",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });

    expect(selectResponse.statusCode).toBe(200);
    expect(selectResponse.json()).toEqual({
      workspace: {
        id: expect.stringMatching(/^wrk_/),
        alias: "backend",
        machineId: pairResponse.json().deviceId,
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });
  });

  it("allows a paired companion to register a workspace with its machine token", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
      cookies: {
        [SESSION_COOKIE_NAME]: "session_admin",
      },
    });

    const pairResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: startResponse.json().pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:device",
      },
    });

    const selectResponse = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/select",
      headers: {
        authorization: `Bearer ${pairResponse.json().machineSessionToken}`,
      },
      payload: {
        machineId: pairResponse.json().deviceId,
        alias: "backend",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });

    expect(selectResponse.statusCode).toBe(200);
    expect(selectResponse.json()).toEqual({
      workspace: {
        id: expect.stringMatching(/^wrk_/),
        alias: "backend",
        machineId: pairResponse.json().deviceId,
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });
  });

  it("rejects workspace registration with an invalid companion machine token", async () => {
    app = buildApp({
      sessionService: createStrictTestSessionService(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/select",
      headers: {
        authorization: "Bearer machine_invalid",
      },
      payload: {
        machineId: "dev_missing",
        alias: "backend",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid companion machine session.",
        requestId: expect.any(String),
      },
    });
  });

  it("surfaces paired companion and active workspace state in the dashboard payload", async () => {
    app = buildApp();

    const startResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/start",
    });

    const pairResponse = await app.inject({
      method: "POST",
      url: "/api/v1/companion/pair/complete",
      payload: {
        pairingCode: startResponse.json().pairingCode,
        machineLabel: "Devbox",
        machineFingerprintHash: "sha256:device",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/select",
      payload: {
        machineId: pairResponse.json().deviceId,
        alias: "clm_tool",
        canonicalPathHash: "sha256:path-a",
        displayPathHint: "D:/Personal_Project/clm_tool",
      },
    });

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
    });

    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.json()).toEqual({
      recentConversations: [],
      recentAgentRuns: [],
      activeWorkspace: {
        id: expect.stringMatching(/^wrk_/),
        alias: "clm_tool",
        status: "active",
        displayPathHint: "D:/Personal_Project/clm_tool",
        lastUsedAt: expect.any(String),
      },
      companion: {
        connected: true,
        machineLabel: "Devbox",
      },
      providerSummary: {
        eligibleCount: 0,
        cooldownCount: 0,
        lastExhaustedAt: null,
      },
    });
  });
});

describe("production app wiring", () => {
  it("uses the real dashboard resolvers and database dashboard repository in the production app path", async () => {
    vi.resetModules();

    const createDatabaseDashboardRepository = vi.fn(() => ({
      listRecentConversations: async () => [],
      listRecentAgentRuns: async () => [],
      getActiveWorkspace: async () => null,
    }));
    const createDatabaseCompanionRepository = vi.fn(() => ({
      createPairingChallenge: async () => ({
        pairingCode: "pair_stub",
        expiresAt: "2026-07-04T12:05:00.000Z",
      }),
      completePairing: async () => ({
        deviceId: "dev_stub",
        machineSessionToken: "machine_stub",
      }),
      getCompanionStatus: async () => ({
        connected: false,
        machineLabel: null,
        deviceId: null,
      }),
    }));
    const createDatabaseWorkspacesRepository = vi.fn(() => ({
      listForUser: async () => [],
      selectWorkspace: async () => ({
        workspace: {
          id: "ws_stub",
          alias: "stub",
          machineId: "dev_stub",
          status: "active",
          displayPathHint: null,
        },
      }),
    }));
    const createDashboardService = vi.fn(() => ({
      getDashboard: async () => ({
        recentConversations: [],
        recentAgentRuns: [],
        activeWorkspace: null,
        companion: {
          connected: false,
          machineLabel: null,
        },
        providerSummary: {
          eligibleCount: 0,
          cooldownCount: 0,
          lastExhaustedAt: null,
        },
      }),
    }));

    vi.doMock("./modules/conversations/repository.js", () => ({
      createDatabaseConversationRepository: vi.fn(() => ({})),
      createInMemoryConversationRepository: vi.fn(() => ({})),
    }));
    vi.doMock("./modules/session/service.js", () => ({
      createDatabaseSessionService: vi.fn(() => ({})),
      createInMemorySessionService: vi.fn(() => ({})),
    }));
    vi.doMock("./modules/chat/service.js", () => ({
      createChatService: vi.fn(() => ({})),
    }));
    vi.doMock("./modules/providers/repository.js", () => ({
      listEligibleChatModels: vi.fn(async () => []),
      recordProviderAttempt: vi.fn(),
    }));
    vi.doMock("./modules/dashboard/repository.js", () => ({
      createDatabaseDashboardRepository,
      createInMemoryDashboardRepository: vi.fn(() => ({
        listRecentConversations: async () => [],
        listRecentAgentRuns: async () => [],
        getActiveWorkspace: async () => null,
      })),
    }));
    vi.doMock("./modules/companion/repository.js", () => ({
      createDatabaseCompanionRepository,
      createInMemoryCompanionRepository: vi.fn(() => ({
        createPairingChallenge: async () => ({
          pairingCode: "pair_stub",
          expiresAt: "2026-07-04T12:05:00.000Z",
        }),
        completePairing: async () => ({
          deviceId: "dev_stub",
          machineSessionToken: "machine_stub",
        }),
        getCompanionStatus: async () => ({
          connected: false,
          machineLabel: null,
          deviceId: null,
        }),
      })),
    }));
    vi.doMock("./modules/companion/service.js", () => ({
      createCompanionService: vi.fn((options) => ({
        startPairing: async (userId: string) =>
          options.repository.createPairingChallenge(userId),
        completePairing: async (input: {
          pairingCode: string;
          machineLabel: string;
          machineFingerprintHash: string;
        }) => options.repository.completePairing(input),
        getStatus: async (userId: string) =>
          options.repository.getCompanionStatus(userId),
      })),
    }));
    const createWorkspacesService = vi.fn((options) => ({
      listForUser: async (userId: string) => ({
        workspaces: await options.repository.listForUser(userId),
      }),
      selectWorkspace: async (
        userId: string,
        input: {
          machineId: string;
          alias: string;
          canonicalPathHash: string;
          displayPathHint?: string;
        },
      ) => options.repository.selectWorkspace(userId, input),
    }));
    vi.doMock("./modules/dashboard/service.js", () => ({
      createDashboardService,
    }));
    vi.doMock("./modules/workspaces/repository.js", () => ({
      createDatabaseWorkspacesRepository,
      createInMemoryWorkspacesRepository: vi.fn(() => ({
        listForUser: async () => [],
        selectWorkspace: async () => ({
          workspace: {
            id: "ws_stub",
            alias: "stub",
            machineId: "dev_stub",
            status: "active",
            displayPathHint: null,
          },
        }),
      })),
    }));
    vi.doMock("./modules/workspaces/service.js", () => ({
      createWorkspacesService,
    }));
    vi.doMock("./modules/conversations/routes.js", () => ({
      registerConversationRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/chat/routes.js", () => ({
      registerChatRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/session/routes.js", () => ({
      registerSessionRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./plugins/session.js", () => ({
      registerSessionContext: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/dashboard/routes.js", () => ({
      registerDashboardRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/companion/routes.js", () => ({
      registerCompanionRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/workspaces/routes.js", () => ({
      registerWorkspacesRoutes: vi.fn(async () => {}),
    }));
    vi.doMock("./modules/providers/gemini-client.js", () => ({
      invokeGemini: vi.fn(),
      geminiDriver: { key: "gemini", testConnection: vi.fn(), invokeChat: vi.fn() },
    }));
    vi.doMock("./modules/providers/openrouter-client.js", () => ({
      invokeOpenRouter: vi.fn(),
      openRouterDriver: {
        key: "openrouter",
        testConnection: vi.fn(),
        invokeChat: vi.fn(),
      },
    }));

    const { buildProductionApp } = await import("./app.js");
    const productionApp = buildProductionApp();
    await productionApp.close();

    expect(createDashboardService).toHaveBeenCalledTimes(1);
    expect(createDatabaseDashboardRepository).toHaveBeenCalledTimes(1);
    expect(createDatabaseCompanionRepository).toHaveBeenCalledTimes(1);
    expect(createDatabaseWorkspacesRepository).toHaveBeenCalledTimes(1);
    expect(createDashboardService).toHaveBeenCalledWith({
      repository: createDatabaseDashboardRepository.mock.results[0]?.value,
    });
    expect(createWorkspacesService).toHaveBeenCalledWith({
      repository: createDatabaseWorkspacesRepository.mock.results[0]?.value,
    });
  });
});
