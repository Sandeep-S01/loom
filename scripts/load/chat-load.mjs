import { randomUUID } from "node:crypto";

const config = readConfig();
const latencies = [];
const failures = [];
let failoverCount = 0;

const cookie = await login();
const models = await requestJson("/api/v1/models/selector?mode=chat", { cookie });
const selectedModel = models.models?.[0] ?? models[0];
if (!selectedModel?.id) throw new Error("No eligible chat model is available for load validation.");

let nextIndex = 0;
async function worker() {
  while (nextIndex < config.requests) {
    const requestNo = ++nextIndex;
    const startedAt = performance.now();
    let conversationId;
    try {
      const created = await requestJson("/api/v1/conversations", {
        cookie,
        method: "POST",
        body: { title: `Load validation ${requestNo}`, mode: "chat" },
      });
      conversationId = created.conversation.id;
      const response = await requestJson(`/api/v1/conversations/${conversationId}/messages`, {
        cookie,
        method: "POST",
        body: {
          content: [{ type: "text", text: config.prompt }],
          modelId: selectedModel.id,
          idempotencyKey: randomUUID(),
        },
      });
      if (response.providerSwitched) failoverCount += 1;
      latencies.push(performance.now() - startedAt);
    } catch (error) {
      failures.push({ requestNo, error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (conversationId) {
        await requestJson(`/api/v1/conversations/${conversationId}`, {
          cookie,
          method: "DELETE",
        }).catch(() => undefined);
      }
    }
  }
}

await Promise.all(Array.from({ length: config.concurrency }, () => worker()));

const report = {
  target: config.baseUrl,
  requests: config.requests,
  concurrency: config.concurrency,
  succeeded: latencies.length,
  failed: failures.length,
  errorRate: failures.length / config.requests,
  failoverCount,
  latencyMs: {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    max: latencies.length ? Math.round(Math.max(...latencies)) : null,
  },
  sampleFailures: failures.slice(0, 5),
};
console.log(JSON.stringify(report, null, 2));

if (report.errorRate > config.maxErrorRate || (report.latencyMs.p95 ?? Infinity) > config.maxP95Ms) {
  process.exitCode = 1;
}

async function login() {
  const response = await fetch(`${config.baseUrl}/api/v1/session/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  if (!response.ok) throw new Error(`Login failed with HTTP ${response.status}.`);
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Login did not return a session cookie.");
  return setCookie.split(";", 1)[0];
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: { ...jsonHeaders(), ...(options.cookie ? { cookie: options.cookie } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} returned ${response.status}: ${body.slice(0, 300)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function jsonHeaders() {
  return {
    "content-type": "application/json",
    ...(config.origin ? { origin: config.origin } : {}),
  };
}

function percentile(values, value) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil((value / 100) * sorted.length) - 1]);
}

function readConfig() {
  if (process.env.LOAD_TEST_CONFIRM !== "true") {
    throw new Error("Set LOAD_TEST_CONFIRM=true to acknowledge that this sends real provider requests.");
  }
  const baseUrl = process.env.LOAD_TEST_BASE_URL;
  if (!baseUrl) throw new Error("LOAD_TEST_BASE_URL is required.");
  const requests = boundedInt("LOAD_TEST_REQUESTS", 20, 1, 500);
  const concurrency = boundedInt("LOAD_TEST_CONCURRENCY", 2, 1, 50);
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    origin: process.env.LOAD_TEST_ORIGIN,
    email: process.env.LOAD_TEST_EMAIL ?? "user@clm.local",
    password: process.env.LOAD_TEST_PASSWORD ?? "changeme",
    prompt: process.env.LOAD_TEST_PROMPT ?? "Reply with the single word: healthy",
    requests,
    concurrency: Math.min(concurrency, requests),
    maxErrorRate: boundedNumber("LOAD_TEST_MAX_ERROR_RATE", 0.01, 0, 1),
    maxP95Ms: boundedInt("LOAD_TEST_MAX_P95_MS", 90_000, 100, 300_000),
  };
}

function boundedInt(name, fallback, min, max) {
  return Math.trunc(boundedNumber(name, fallback, min, max));
}

function boundedNumber(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}
