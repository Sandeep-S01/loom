"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Route,
  Settings,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  archiveAdminRegistryModel,
  getDashboard,
  getAdminModelUsageSummary,
  getProvidersStatus,
  getSession,
  checkAdminProviderCredential,
  listAdminModelUsageCounters,
  listAdminModelCatalog,
  listAdminModelPolicies,
  listAdminModelRegistry,
  listAdminModelRuntimeHealth,
  listAdminProviderHealth,
  listAdminProviderSyncStatus,
  listAdminProviders,
  listAdminRoutingAttempts,
  listModels,
  logout,
  registerAdminCatalogModel,
  resetAdminModelRuntimeHealth,
  resetAdminProviderHealth,
  runAdminDiscoveryJob,
  updateAdminProvider,
  upsertAdminModelPolicy,
} from "../lib/api";
import type {
  AdminProviderItem,
  AdminModelCatalogListResponse,
  AdminModelPolicyItem,
  AdminModelPolicyListResponse,
  AdminModelRegistryListResponse,
  AdminModelRuntimeHealthItem,
  AdminModelRuntimeHealthListResponse,
  AdminModelUsageCounterListResponse,
  AdminModelUsageSummaryResponse,
  AdminProviderHealthItem,
  AdminProviderHealthListResponse,
  AdminProviderListResponse,
  AdminProviderSyncStatusItem,
  AdminProviderSyncStatusListResponse,
  AdminRoutingAttemptsResponse,
  DashboardResponse,
  ModelRegistryItem,
  ProvidersResponse,
  SessionResponse,
} from "../lib/types";
import { LoomLogo } from "./loom-logo";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { ErrorState } from "./ui/error-state";
import { Panel } from "./ui/panel";
import { StatusPill } from "./ui/status-pill";

type AdminSection =
  | "overview"
  | "models"
  | "marketplace"
  | "providers"
  | "usage"
  | "failover"
  | "settings";

const ADMIN_SECTIONS: Array<{
  id: AdminSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "models", label: "Models", icon: KeyRound },
  { id: "marketplace", label: "Catalog", icon: Store },
  { id: "providers", label: "Providers", icon: Gauge },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "failover", label: "Routing", icon: Route },
  { id: "settings", label: "Settings", icon: Settings },
];

const ADMIN_SECTION_COPY: Record<AdminSection, string> = {
  overview: "Monitor routing readiness, provider health, and recent usage.",
  models: "Control which registry models can serve customer chat.",
  marketplace: "Review discovered free catalog models and approve them for routing.",
  providers: "Check provider credentials and configured model coverage.",
  usage: "Review request volume, error count, token usage, and estimated cost.",
  failover: "Audit provider attempts, failures, cooldowns, and routing traces.",
  settings: "Review backend-owned operational configuration and role boundaries.",
};

export function AdminConsoleShell() {
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [adminProviders, setAdminProviders] =
    useState<AdminProviderListResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [providerSyncStatus, setProviderSyncStatus] =
    useState<AdminProviderSyncStatusListResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [adminCatalog, setAdminCatalog] =
    useState<AdminModelCatalogListResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [adminRegistry, setAdminRegistry] =
    useState<AdminModelRegistryListResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [adminPolicies, setAdminPolicies] =
    useState<AdminModelPolicyListResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [modelRuntimeHealth, setModelRuntimeHealth] =
    useState<AdminModelRuntimeHealthListResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [providerHealth, setProviderHealth] =
    useState<AdminProviderHealthListResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [routingAttempts, setRoutingAttempts] =
    useState<AdminRoutingAttemptsResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [adminUsageSummary, setAdminUsageSummary] =
    useState<AdminModelUsageSummaryResponse>({
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      fallbackCount: 0,
      rateLimitCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMsTotal: 0,
      latencySampleCount: 0,
      averageLatencyMs: null,
      costUsdMicros: 0,
    });
  const [adminUsageCounters, setAdminUsageCounters] =
    useState<AdminModelUsageCounterListResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    setError(null);
    const sessionResponse = await getSession();
    if (sessionResponse.user.role !== "admin") {
      throw new Error("Admin access required.");
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [
      dashboardResponse,
      providersResponse,
      adminProvidersResponse,
      providerSyncStatusResponse,
      adminCatalogResponse,
      adminRegistryResponse,
      adminPoliciesResponse,
      modelRuntimeHealthResponse,
      providerHealthResponse,
      routingAttemptsResponse,
      adminUsageSummaryResponse,
      adminUsageCountersResponse,
      modelsResponse,
    ] = await Promise.all([
      getDashboard(),
      getProvidersStatus(),
      listAdminProviders({ pageSize: 100 }),
      listAdminProviderSyncStatus({ pageSize: 100 }),
      listAdminModelCatalog({ pageSize: 100 }),
      listAdminModelRegistry({ pageSize: 100 }),
      listAdminModelPolicies({ pageSize: 100 }),
      listAdminModelRuntimeHealth({ pageSize: 100 }),
      listAdminProviderHealth({ pageSize: 100 }),
      listAdminRoutingAttempts({ pageSize: 50 }),
      getAdminModelUsageSummary({
        from: weekAgo.toISOString(),
        to: now.toISOString(),
      }),
      listAdminModelUsageCounters({
        from: weekAgo.toISOString(),
        to: now.toISOString(),
        granularity: "day",
        pageSize: 50,
      }),
      listModels({ includeDisabled: true }),
    ]);

    setSession(sessionResponse);
    setDashboard(dashboardResponse);
    setProviders(providersResponse);
    setAdminProviders(adminProvidersResponse);
    setProviderSyncStatus(providerSyncStatusResponse);
    setAdminCatalog(adminCatalogResponse);
    setAdminRegistry(adminRegistryResponse);
    setAdminPolicies(adminPoliciesResponse);
    setModelRuntimeHealth(modelRuntimeHealthResponse);
    setProviderHealth(providerHealthResponse);
    setRoutingAttempts(routingAttemptsResponse);
    setAdminUsageSummary(adminUsageSummaryResponse);
    setAdminUsageCounters(adminUsageCountersResponse);
    setModels(modelsResponse.models);
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    loadAdminData()
      .catch((loadError) => {
        if (mounted) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Failed to load admin console.";

          if (message === "Authentication required." && typeof window !== "undefined") {
            window.location.assign("/login?next=/admin");
            return;
          }

          setError(message);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [loadAdminData]);

  const overview = useMemo(() => {
    const activeModels = models.filter((model) => model.effectiveStatus === "active");
    const disabledModels = models.filter((model) => model.effectiveStatus === "disabled");
    const cooldownModels = models.filter(
      (model) => model.effectiveStatus === "rate_limited",
    );
    const authInvalidModels = models.filter(
      (model) => model.runtimeStatus === "auth_invalid",
    );
    const openCircuitModels = models.filter(
      (model) => model.runtimeStatus === "open_circuit",
    );
    const configuredProviders =
      providers?.providers.filter((provider) => provider.keyConfigured).length ?? 0;
    const providerCount = providers?.providers.length ?? 0;
    const usage = {
      requests: adminUsageSummary.requestCount,
      errors: adminUsageSummary.failureCount,
      tokens: adminUsageSummary.totalTokens,
      cost: adminUsageSummary.costUsdMicros,
    };
    const errorRate = usage.requests > 0 ? usage.errors / usage.requests : 0;
    const criticalIssueCount =
      (dashboard?.providerSummary.eligibleCount ?? 0) === 0 ? 1 : 0;
    const warningCount =
      cooldownModels.length +
      authInvalidModels.length +
      openCircuitModels.length +
      (providerCount > configuredProviders ? 1 : 0);

    return {
      activeModels: activeModels.length,
      authInvalidModels: authInvalidModels.length,
      cooldownModels: cooldownModels.length,
      criticalIssueCount,
      disabledModels: disabledModels.length,
      eligibleModels: dashboard?.providerSummary.eligibleCount ?? 0,
      errorRate,
      freeModels: adminCatalog.items.filter((model) => model.costTier === "free").length,
      openCircuitModels: openCircuitModels.length,
      configuredProviders,
      providerCount,
      requests: usage.requests,
      errors: usage.errors,
      tokens: usage.tokens,
      costUsdMicros: usage.cost,
      lastMarketplaceSync: latestSyncSuccess(providerSyncStatus.items),
      warningCount,
    };
  }, [adminCatalog.items, adminUsageSummary, dashboard, models, providerSyncStatus.items, providers]);

  async function runAction(actionId: string, action: () => Promise<void>) {
    setPendingAction(actionId);
    setError(null);
    try {
      await action();
      await loadAdminData();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Admin action failed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleLogout() {
    setPendingAction("logout");
    setError(null);
    try {
      await logout();
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : "Logout failed.",
      );
      setPendingAction(null);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[color:var(--color-bg-base)] text-text-primary">
        <div className="text-sm text-text-muted">Loading admin console...</div>
      </main>
    );
  }

  if (error === "Admin access required.") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[color:var(--color-bg-base)] px-6 text-text-primary">
        <ErrorState
          action={
            <Link className="ui-button-subtle rounded-lg px-4 py-2 text-sm" href="/dashboard">
              Back to workspace
            </Link>
          }
          message="Your current account does not have permission to manage providers, models, or system settings."
          title="Admin access required"
        />
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh w-full overflow-hidden bg-[color:var(--color-bg-base)] text-text-primary">
      {/* Mobile Nav Backdrop */}
      {isAdminSidebarOpen && (
        <div
          className="fixed inset-0 z-35 bg-[#26251e]/18 backdrop-blur-sm lg:hidden"
          onClick={() => setIsAdminSidebarOpen(false)}
        />
      )}

      <aside className={[
        "fixed inset-y-0 left-0 z-40 flex w-[248px] shrink-0 flex-col border-r border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-sidebar)] px-4 py-4 transition-transform duration-250 ease-out lg:translate-x-0",
        isAdminSidebarOpen ? "translate-x-0" : "-translate-x-full"
      ].join(" ")}>
        <div className="flex items-center justify-between">
          <LoomLogo
            className="select-none text-text-primary"
            textClassName="h-[25px] w-auto"
            variant="mono"
          />
        </div>
        <nav className="mt-6 space-y-1">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon;
            const selected = section.id === activeSection;
            return (
              <button
                key={section.id}
                className={[
                  "flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-left text-[13px] transition",
                  selected
                    ? "bg-[color:var(--color-surface-panel)] font-medium text-text-primary shadow-[inset_2px_0_0_var(--color-accent)]"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                ].join(" ")}
                onClick={() => {
                  setActiveSection(section.id);
                  setIsAdminSidebarOpen(false);
                }}
                type="button"
              >
                <Icon aria-hidden="true" size={16} strokeWidth={1.6} />
                {section.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] px-3 py-3">
          <p className="truncate text-sm font-medium">
            {session?.user.displayName ?? "Admin"}
          </p>
          <p className="mt-0.5 text-xs capitalize text-text-muted">
            {session?.user.role ?? "admin"}
          </p>
          <button
            className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[color:var(--color-border-subtle)] bg-surface px-3 text-xs font-medium text-text-secondary transition hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingAction === "logout"}
            onClick={() => void handleLogout()}
            type="button"
          >
            <LogOut aria-hidden="true" size={15} strokeWidth={1.6} />
            Logout
          </button>
        </div>
      </aside>

      <section className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden lg:ml-[248px]">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 sm:px-6 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open admin navigation"
              className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] p-2 text-text-secondary transition hover:border-[color:var(--color-border-strong)] hover:text-text-primary lg:hidden"
              onClick={() => setIsAdminSidebarOpen(true)}
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="font-headline text-xl font-semibold tracking-[-0.03em] text-text-primary sm:text-2xl">
                {ADMIN_SECTIONS.find((section) => section.id === activeSection)?.label}
              </h1>
              <p className="mt-1 text-xs text-text-secondary">
                {ADMIN_SECTION_COPY[activeSection]}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill tone={(dashboard?.providerSummary.eligibleCount ?? 0) > 0 ? "success" : "error"}>
              {dashboard?.providerSummary.eligibleCount ?? 0} eligible
            </StatusPill>
            <Button
              disabled={pendingAction === "refresh"}
              onClick={() => void runAction("refresh", () => loadAdminData())}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" size={15} strokeWidth={1.5} />
              Refresh
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-6">
          {error ? (
            <div className="ui-alert-error mb-5 px-3.5 py-2.5 text-xs">{error}</div>
          ) : null}
          {activeSection === "overview" ? (
            <AdminOverview overview={overview} onSelectSection={setActiveSection} />
          ) : null}
          {activeSection === "models" ? (
            <AdminModels
              policies={adminPolicies}
              providers={adminProviders}
              registry={adminRegistry}
              onArchive={(registryModelId) =>
                runAction(`registry:archive:${registryModelId}`, async () => {
                  await archiveAdminRegistryModel(
                    registryModelId,
                    "Archived from admin registry.",
                  );
                })
              }
              onSavePolicy={(registryModelId, payload) =>
                runAction(`policy:save:${registryModelId}`, async () => {
                  await upsertAdminModelPolicy(registryModelId, payload);
                })
              }
              pendingAction={pendingAction}
            />
          ) : null}
          {activeSection === "marketplace" ? (
            <AdminMarketplace
              catalog={adminCatalog}
              providers={adminProviders}
              registry={adminRegistry}
              onApprove={(catalogModelId) =>
                runAction(`catalog:approve:${catalogModelId}`, async () => {
                  await registerAdminCatalogModel({ catalogModelId });
                })
              }
              pendingAction={pendingAction}
            />
          ) : null}
          {activeSection === "providers" ? (
            <AdminProviders
              providerModels={providers}
              providers={adminProviders}
              syncStatus={providerSyncStatus}
              onCheckCredential={(providerId) =>
                runAction(`provider:check:${providerId}`, async () => {
                  await checkAdminProviderCredential({ providerId });
                })
              }
              onRunDiscovery={(providerId) =>
                runAction(`provider:discover:${providerId}`, async () => {
                  await runAdminDiscoveryJob(providerId);
                })
              }
              onUpdateProvider={(providerId, payload) =>
                runAction(`provider:update:${providerId}`, async () => {
                  await updateAdminProvider(providerId, payload);
                })
              }
              pendingAction={pendingAction}
            />
          ) : null}
          {activeSection === "usage" ? (
            <AdminUsage
              counters={adminUsageCounters}
              providers={adminProviders}
              registry={adminRegistry}
              summary={adminUsageSummary}
            />
          ) : null}
          {activeSection === "failover" ? (
            <AdminFailover
              modelRuntimeHealth={modelRuntimeHealth}
              onResetModelHealth={(registryModelId) =>
                runAction(`model-health:reset:${registryModelId}`, async () => {
                  await resetAdminModelRuntimeHealth(registryModelId);
                })
              }
              onResetProviderHealth={(providerId) =>
                runAction(`provider-health:reset:${providerId}`, async () => {
                  await resetAdminProviderHealth(providerId);
                })
              }
              pendingAction={pendingAction}
              providerHealth={providerHealth}
              providers={adminProviders}
              registry={adminRegistry}
              routingAttempts={routingAttempts}
              usageSummary={adminUsageSummary}
            />
          ) : null}
          {activeSection === "settings" ? <AdminSettings /> : null}
        </div>
      </section>
    </div>
  );
}

function AdminOverview({
  onSelectSection,
  overview,
}: {
  onSelectSection: (section: AdminSection) => void;
  overview: {
    activeModels: number;
    authInvalidModels: number;
    cooldownModels: number;
    criticalIssueCount: number;
    disabledModels: number;
    eligibleModels: number;
    errorRate: number;
    freeModels: number;
    openCircuitModels: number;
    configuredProviders: number;
    providerCount: number;
    requests: number;
    errors: number;
    tokens: number;
    costUsdMicros: number;
    lastMarketplaceSync: string | null;
    warningCount: number;
  };
}) {
  const isHealthy = overview.criticalIssueCount === 0 && overview.warningCount === 0;
  const isBlocked = overview.eligibleModels === 0;
  const healthTone = isBlocked ? "blocked" : isHealthy ? "healthy" : "attention";
  const healthCopy =
    healthTone === "healthy"
      ? "Routing is ready"
      : healthTone === "blocked"
        ? "Routing needs attention"
        : "Routing is usable with warnings";
  const riskItems = [
    overview.eligibleModels === 0
      ? "No eligible chat models are available for customers."
      : null,
    overview.providerCount > overview.configuredProviders
      ? `${overview.providerCount - overview.configuredProviders} provider key configuration issue${overview.providerCount - overview.configuredProviders === 1 ? "" : "s"}.`
      : null,
    overview.cooldownModels > 0
      ? `${overview.cooldownModels} model${overview.cooldownModels === 1 ? "" : "s"} currently cooling down.`
      : null,
    overview.openCircuitModels > 0
      ? `${overview.openCircuitModels} model${overview.openCircuitModels === 1 ? "" : "s"} with an open circuit.`
      : null,
    overview.authInvalidModels > 0
      ? `${overview.authInvalidModels} model${overview.authInvalidModels === 1 ? "" : "s"} reporting invalid auth.`
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[color:var(--color-border-subtle)] bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={[
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                healthTone === "healthy"
                  ? "bg-state-healthy/10 text-state-healthy"
                  : healthTone === "blocked"
                    ? "bg-state-blocked/10 text-state-blocked"
                    : "bg-state-degraded/10 text-state-degraded",
              ].join(" ")}
            >
              {healthTone === "healthy" ? (
                <ShieldCheck aria-hidden="true" size={18} strokeWidth={1.7} />
              ) : (
                <AlertTriangle aria-hidden="true" size={18} strokeWidth={1.7} />
              )}
            </span>
            <div>
              <h2 className="font-headline text-lg font-semibold tracking-[-0.02em] text-text-primary">
                {healthCopy}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                {isBlocked
                  ? "At least one active eligible model is required before customers can chat."
                  : isHealthy
                    ? "Routing, providers, and registry state are currently ready for customer traffic."
                    : "Routing is available, but the operational queue needs review."}
              </p>
            </div>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => onSelectSection(isBlocked ? "models" : "failover")}
            size="sm"
            type="button"
            variant={isBlocked ? "primary" : "secondary"}
          >
            {isBlocked ? "Fix models" : "Review routing"}
          </Button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Eligible models" value={overview.eligibleModels} />
        <MetricCard label="Provider keys" value={`${overview.configuredProviders}/${overview.providerCount}`} />
        <MetricCard label="Requests" value={formatNumber(overview.requests)} />
        <MetricCard label="Error rate" value={`${(overview.errorRate * 100).toFixed(1)}%`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Panel eyebrow="Operations Queue" title="Priority checks" className="rounded-lg">
          {riskItems.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-state-healthy/20 bg-[color:var(--color-surface-panel)] px-4 py-3">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-state-healthy"
                size={17}
                strokeWidth={1.6}
              />
              <p className="text-sm leading-6 text-text-secondary">
                No active routing risks detected.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--color-border-subtle)] rounded-lg border border-[color:var(--color-border-subtle)]">
              {riskItems.map((item) => (
                <div className="flex items-start gap-3 px-4 py-3" key={item}>
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-state-degraded"
                    size={16}
                    strokeWidth={1.6}
                  />
                  <p className="text-sm leading-6 text-text-secondary">{item}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel eyebrow="Summary" title="Registry and catalog" className="rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <MetricInline label="Active" value={overview.activeModels} />
            <MetricInline label="Disabled" value={overview.disabledModels} />
            <MetricInline label="Catalog" value={overview.freeModels} />
            <MetricInline label="Tokens" value={formatNumber(overview.tokens)} />
          </div>
          <div className="mt-4 border-t border-[color:var(--color-border-subtle)] pt-4">
            <p className="text-xs text-text-muted">Last catalog sync</p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {overview.lastMarketplaceSync
                ? formatDateTime(overview.lastMarketplaceSync)
                : "Never synced"}
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AdminModels({
  policies,
  providers,
  registry,
  onArchive,
  onSavePolicy,
  pendingAction,
}: {
  policies: AdminModelPolicyListResponse;
  providers: AdminProviderListResponse;
  registry: AdminModelRegistryListResponse;
  onArchive: (registryModelId: string) => void;
  onSavePolicy: (
    registryModelId: string,
    payload: {
      enabled: boolean;
      visibleInSelector: boolean;
      priorityRank: number;
      defaultForChat: boolean;
      defaultForAgent: boolean;
      requiresCompanion: boolean;
      requestsPerMinuteLimit: number | null;
      tokensPerDayLimit: number | null;
      tokensPerRequestLimit: number | null;
      notes: string | null;
    },
  ) => void;
  pendingAction: string | null;
}) {
  const [query, setQuery] = useState("");
  const [providerId, setProviderId] = useState("");
  const [selectedRegistryId, setSelectedRegistryId] = useState<string | null>(null);
  const providerNameById = useMemo(
    () => new Map(providers.items.map((provider) => [provider.id, provider.name])),
    [providers.items],
  );
  const policyByRegistryId = useMemo(
    () => new Map(policies.items.map((policy) => [policy.registryModelId, policy])),
    [policies.items],
  );
  const registeredItems = registry.items.filter((item) => item.status === "registered");
  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return registeredItems.filter((entry) => {
      const matchesProvider = !providerId || entry.catalog.providerId === providerId;
      const providerName =
        providerNameById.get(entry.catalog.providerId) ?? entry.catalog.providerId;
      const policy = policyByRegistryId.get(entry.id);
      const searchable = [
        entry.catalog.displayName,
        entry.catalog.externalModelKey,
        providerName,
        entry.status,
        policy?.enabled ? "enabled" : "disabled",
        policy?.visibleInSelector ? "visible" : "hidden",
      ]
        .join(" ")
        .toLowerCase();
      return matchesProvider && searchable.includes(normalizedQuery);
    });
  }, [policyByRegistryId, providerId, providerNameById, query, registeredItems]);
  const selectedEntry =
    filteredModels.find((entry) => entry.id === selectedRegistryId) ??
    filteredModels[0] ??
    null;
  const selectedPolicy = selectedEntry
    ? policyByRegistryId.get(selectedEntry.id) ?? null
    : null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_420px]">
      <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
        <div className="flex flex-col gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Model registry</h2>
            <p className="mt-1 text-xs text-text-secondary">
              {filteredModels.length} of {registeredItems.length} approved models shown.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_170px]">
            <input
              className="ui-input h-9 px-3 text-sm"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search registry"
              value={query}
            />
            <select
              className="ui-input h-9 px-3 text-sm"
              onChange={(event) => setProviderId(event.target.value)}
              value={providerId}
            >
              <option value="">All providers</option>
              {providers.items.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {registeredItems.length === 0 ? (
          <div className="p-5">
            <EmptyState
              description="Approve free models from Catalog before managing registry policy."
              title="No models approved"
            />
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Provider</th>
                <th className="px-4 py-3 font-semibold">Policy</th>
                <th className="px-4 py-3 font-semibold">Limits</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
              {filteredModels.map((entry) => {
                const policy = policyByRegistryId.get(entry.id);
                const isSelected = selectedEntry?.id === entry.id;
                return (
                  <tr
                    className={isSelected ? "bg-bg-hover" : "hover:bg-bg-hover"}
                    key={entry.id}
                  >
                    <td className="max-w-[300px] px-4 py-3">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {entry.catalog.displayName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                        {entry.catalog.externalModelKey}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {providerNameById.get(entry.catalog.providerId) ?? entry.catalog.providerId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill tone={policy?.enabled !== false ? "success" : "neutral"}>
                          {policy?.enabled !== false ? "enabled" : "disabled"}
                        </StatusPill>
                        <StatusPill tone={policy?.visibleInSelector !== false ? "info" : "neutral"}>
                          {policy?.visibleInSelector !== false ? "visible" : "hidden"}
                        </StatusPill>
                        {policy?.defaultForChat ? (
                          <StatusPill tone="success">default chat</StatusPill>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-text-secondary">
                      <div>rpm: {policy?.requestsPerMinuteLimit ?? "none"}</div>
                      <div className="mt-0.5">day: {policy?.tokensPerDayLimit ?? "none"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => setSelectedRegistryId(entry.id)}
                          size="sm"
                          type="button"
                          variant={isSelected ? "primary" : "secondary"}
                        >
                          Policy
                        </Button>
                        <Button
                          disabled={pendingAction === `registry:archive:${entry.id}`}
                          onClick={() => onArchive(entry.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {pendingAction === `registry:archive:${entry.id}`
                            ? "Archiving..."
                            : "Archive"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredModels.length === 0 && registeredItems.length > 0 ? (
          <div className="border-t border-[color:var(--color-border-subtle)] p-5">
            <EmptyState
              title="No matching registry models"
              description="Clear search or filters to return to approved models."
            />
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
        {selectedEntry ? (
          <RegistryPolicyPanel
            entry={selectedEntry}
            isSaving={pendingAction === `policy:save:${selectedEntry.id}`}
            onSave={(payload) => onSavePolicy(selectedEntry.id, payload)}
            policy={selectedPolicy}
            providerName={
              providerNameById.get(selectedEntry.catalog.providerId) ??
              selectedEntry.catalog.providerId
            }
          />
        ) : (
          <div className="p-5">
          <EmptyState
            title="No model selected"
            description="Approve a catalog model, then select it here to configure policy."
          />
          </div>
        )}
      </section>
    </div>
  );
}

function RegistryPolicyPanel({
  entry,
  isSaving,
  onSave,
  policy,
  providerName,
}: {
  entry: AdminModelRegistryListResponse["items"][number];
  isSaving: boolean;
  onSave: (payload: {
    enabled: boolean;
    visibleInSelector: boolean;
    priorityRank: number;
    defaultForChat: boolean;
    defaultForAgent: boolean;
    requiresCompanion: boolean;
    requestsPerMinuteLimit: number | null;
    tokensPerDayLimit: number | null;
    tokensPerRequestLimit: number | null;
    notes: string | null;
  }) => void;
  policy: AdminModelPolicyItem | null;
  providerName: string;
}) {
  const [enabled, setEnabled] = useState(policy?.enabled ?? true);
  const [visibleInSelector, setVisibleInSelector] = useState(
    policy?.visibleInSelector ?? true,
  );
  const [priorityRank, setPriorityRank] = useState(String(policy?.priorityRank ?? 100));
  const [defaultForChat, setDefaultForChat] = useState(policy?.defaultForChat ?? false);
  const [defaultForAgent, setDefaultForAgent] = useState(policy?.defaultForAgent ?? false);
  const [requiresCompanion, setRequiresCompanion] = useState(
    policy?.requiresCompanion ?? false,
  );
  const [requestsPerMinuteLimit, setRequestsPerMinuteLimit] = useState(
    policy?.requestsPerMinuteLimit == null ? "" : String(policy.requestsPerMinuteLimit),
  );
  const [tokensPerDayLimit, setTokensPerDayLimit] = useState(
    policy?.tokensPerDayLimit == null ? "" : String(policy.tokensPerDayLimit),
  );
  const [tokensPerRequestLimit, setTokensPerRequestLimit] = useState(
    policy?.tokensPerRequestLimit == null ? "" : String(policy.tokensPerRequestLimit),
  );
  const [notes, setNotes] = useState(policy?.notes ?? "");

  useEffect(() => {
    setEnabled(policy?.enabled ?? true);
    setVisibleInSelector(policy?.visibleInSelector ?? true);
    setPriorityRank(String(policy?.priorityRank ?? 100));
    setDefaultForChat(policy?.defaultForChat ?? false);
    setDefaultForAgent(policy?.defaultForAgent ?? false);
    setRequiresCompanion(policy?.requiresCompanion ?? false);
    setRequestsPerMinuteLimit(
      policy?.requestsPerMinuteLimit == null ? "" : String(policy.requestsPerMinuteLimit),
    );
    setTokensPerDayLimit(
      policy?.tokensPerDayLimit == null ? "" : String(policy.tokensPerDayLimit),
    );
    setTokensPerRequestLimit(
      policy?.tokensPerRequestLimit == null ? "" : String(policy.tokensPerRequestLimit),
    );
    setNotes(policy?.notes ?? "");
  }, [entry.id, policy]);

  function nullableNumber(value: string) {
    const trimmed = value.trim();
    return trimmed ? Number(trimmed) : null;
  }

  return (
    <div>
      <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Policy</h2>
        <p className="mt-1 truncate text-xs text-text-secondary">
          {entry.catalog.displayName} - {providerName}
        </p>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Enabled", enabled, setEnabled],
            ["Visible", visibleInSelector, setVisibleInSelector],
            ["Chat default", defaultForChat, setDefaultForChat],
            ["Agent default", defaultForAgent, setDefaultForAgent],
            ["Requires companion", requiresCompanion, setRequiresCompanion],
          ].map(([label, checked, setter]) => (
            <label className="flex items-center gap-2 text-xs text-text-secondary" key={label as string}>
              <input
                checked={checked as boolean}
                className="h-4 w-4 accent-accent"
                onChange={(event) =>
                  (setter as (value: boolean) => void)(event.target.checked)
                }
                type="checkbox"
              />
              {label as string}
            </label>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium text-text-secondary">Priority</span>
          <input
            className="ui-input h-10 w-full px-3 text-sm"
            inputMode="numeric"
            onChange={(event) => setPriorityRank(event.target.value)}
            value={priorityRank}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <PolicyNumberInput
            label="Requests / minute"
            onChange={setRequestsPerMinuteLimit}
            value={requestsPerMinuteLimit}
          />
          <PolicyNumberInput
            label="Tokens / day"
            onChange={setTokensPerDayLimit}
            value={tokensPerDayLimit}
          />
          <PolicyNumberInput
            label="Tokens / request"
            onChange={setTokensPerRequestLimit}
            value={tokensPerRequestLimit}
          />
        </div>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium text-text-secondary">Notes</span>
          <textarea
            className="ui-input min-h-[88px] w-full px-3 py-2 text-sm"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>
        <Button
          disabled={isSaving}
          onClick={() =>
            onSave({
              enabled,
              visibleInSelector,
              priorityRank: Number(priorityRank) || 100,
              defaultForChat,
              defaultForAgent,
              requiresCompanion,
              requestsPerMinuteLimit: nullableNumber(requestsPerMinuteLimit),
              tokensPerDayLimit: nullableNumber(tokensPerDayLimit),
              tokensPerRequestLimit: nullableNumber(tokensPerRequestLimit),
              notes: notes.trim() || null,
            })
          }
          type="button"
          variant="primary"
        >
          {isSaving ? "Saving..." : "Save policy"}
        </Button>
      </div>
    </div>
  );
}

function PolicyNumberInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-text-secondary">{label}</span>
      <input
        className="ui-input h-10 w-full px-3 text-sm"
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        placeholder="No limit"
        value={value}
      />
    </label>
  );
}

function AdminMarketplace({
  catalog,
  providers,
  registry,
  onApprove,
  pendingAction,
}: {
  catalog: AdminModelCatalogListResponse;
  providers: AdminProviderListResponse;
  registry: AdminModelRegistryListResponse;
  onApprove: (catalogModelId: string) => void;
  pendingAction: string | null;
}) {
  const [query, setQuery] = useState("");
  const [providerId, setProviderId] = useState("");
  const [capability, setCapability] = useState("");
  const providerNameById = useMemo(
    () => new Map(providers.items.map((provider) => [provider.id, provider.name])),
    [providers.items],
  );
  const registeredCatalogIds = useMemo(
    () =>
      new Set(
        registry.items
          .filter((entry) => entry.status === "registered")
          .map((entry) => entry.catalogModelId),
      ),
    [registry.items],
  );
  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.items.filter((model) => {
      const matchesProvider = !providerId || model.providerId === providerId;
      const matchesCapability =
        !capability ||
        Boolean(model.capabilities[capability as keyof typeof model.capabilities]);
      const searchable = [
        model.displayName,
        model.externalModelKey,
        providerNameById.get(model.providerId) ?? model.providerId,
        model.releaseStage,
        model.costTier,
      ]
        .join(" ")
        .toLowerCase();

      return matchesProvider && matchesCapability && searchable.includes(normalizedQuery);
    });
  }, [capability, catalog.items, providerId, providerNameById, query]);

  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="flex flex-col gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Model catalog</h2>
          <p className="mt-1 text-xs text-text-secondary">
            {filteredCatalog.length} of {catalog.total} discovered models shown. Approve free
            models before users can route to them.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_170px_140px]">
          <input
            className="ui-input h-9 px-3 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search catalog"
            value={query}
          />
          <select
            className="ui-input h-9 px-3 text-sm"
            onChange={(event) => setProviderId(event.target.value)}
            value={providerId}
          >
            <option value="">All providers</option>
            {providers.items.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <select
            className="ui-input h-9 px-3 text-sm"
            onChange={(event) => setCapability(event.target.value)}
            value={capability}
          >
            <option value="">All capabilities</option>
            <option value="chat">Chat</option>
            <option value="agent">Agent</option>
            <option value="vision">Vision</option>
            <option value="toolUse">Tools</option>
            <option value="jsonMode">JSON</option>
          </select>
        </div>
      </div>
      {catalog.items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No discovered models"
            description="Run discovery from the Providers page, then approve discovered free models here."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-xs">
            <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Provider</th>
                <th className="px-4 py-3 font-semibold">Capabilities</th>
                <th className="px-4 py-3 font-semibold">Context</th>
                <th className="px-4 py-3 font-semibold">Release</th>
                <th className="px-4 py-3 font-semibold">Approval</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
              {filteredCatalog.map((model) => {
                const approved = registeredCatalogIds.has(model.id);
                const deprecated = Boolean(model.deprecatedAt);
                return (
                  <tr className="hover:bg-bg-hover" key={model.id}>
                    <td className="max-w-[300px] px-4 py-3">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {model.displayName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                        {model.externalModelKey}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-text-secondary">
                        {providerNameById.get(model.providerId) ?? model.providerId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {formatCapabilities(model.capabilities).map((item) => (
                          <StatusPill key={item} tone="neutral">
                            {item}
                          </StatusPill>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-text-secondary">
                      {model.contextWindow ? formatNumber(model.contextWindow) : "n/a"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill tone={model.costTier === "free" ? "success" : "warning"}>
                          {model.costTier}
                        </StatusPill>
                        <StatusPill tone={deprecated ? "warning" : "neutral"}>
                          {deprecated ? "deprecated" : model.releaseStage}
                        </StatusPill>
                      </div>
                      <p className="mt-1 text-[10px] text-text-muted">
                        Last seen {formatDateTime(model.lastDiscoveredAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={approved ? "success" : "neutral"}>
                        {approved ? "approved" : "not approved"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        disabled={
                          approved ||
                          deprecated ||
                          model.costTier !== "free" ||
                          pendingAction === `catalog:approve:${model.id}`
                        }
                        onClick={() => onApprove(model.id)}
                        size="sm"
                        type="button"
                        variant={approved ? "secondary" : "primary"}
                      >
                        {approved
                          ? "Approved"
                          : pendingAction === `catalog:approve:${model.id}`
                            ? "Approving..."
                            : "Approve"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filteredCatalog.length === 0 && catalog.items.length > 0 ? (
        <div className="border-t border-[color:var(--color-border-subtle)] p-5">
          <EmptyState
            title="No matching catalog models"
            description="Clear search or filters to return to the discovered catalog."
          />
        </div>
      ) : null}
    </section>
  );
}

function AdminProviders({
  providerModels,
  providers,
  syncStatus,
  onCheckCredential,
  onRunDiscovery,
  onUpdateProvider,
  pendingAction,
}: {
  providerModels: ProvidersResponse | null;
  providers: AdminProviderListResponse;
  syncStatus: AdminProviderSyncStatusListResponse;
  onCheckCredential: (providerId: string) => void;
  onRunDiscovery: (providerId: string) => void;
  onUpdateProvider: (
    providerId: string,
    payload: { defaultSecretRef?: string | null; status?: AdminProviderItem["status"] },
  ) => void;
  pendingAction: string | null;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | AdminProviderItem["status"]>("");
  const [secretRefs, setSecretRefs] = useState<Record<string, string>>({});
  const publicProviderById = useMemo(
    () => new Map((providerModels?.providers ?? []).map((provider) => [provider.id, provider])),
    [providerModels],
  );
  const syncByProviderId = useMemo(
    () => new Map(syncStatus.items.map((item) => [item.providerId, item])),
    [syncStatus.items],
  );

  useEffect(() => {
    setSecretRefs((current) => {
      const next = { ...current };
      for (const provider of providers.items) {
        if (!(provider.id in next)) {
          next[provider.id] = provider.defaultSecretRef ?? "";
        }
      }
      return next;
    });
  }, [providers.items]);

  const filteredProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return providers.items.filter((provider) => {
      const matchesStatus = !statusFilter || provider.status === statusFilter;
      const searchable = [
        provider.name,
        provider.driverKey,
        provider.baseType,
        provider.defaultSecretRef ?? "",
        provider.credentialStatus,
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && searchable.includes(normalizedQuery);
    });
  }, [providers.items, query, statusFilter]);

  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="flex flex-col gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Provider operations</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Configure backend secret references, verify credentials, and discover free models.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,240px)_150px]">
          <input
            className="ui-input h-9 px-3 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search providers"
            value={query}
          />
          <select
            className="ui-input h-9 px-3 text-sm"
            onChange={(event) =>
              setStatusFilter(event.target.value as "" | AdminProviderItem["status"])
            }
            value={statusFilter}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>
      </div>
      {providers.items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No providers configured"
            description="Seed or create providers in the backend before running model discovery."
          />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Secret Reference</th>
              <th className="px-4 py-3 font-semibold">Credential</th>
              <th className="px-4 py-3 font-semibold">Discovery</th>
              <th className="px-4 py-3 font-semibold">Models</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
            {filteredProviders.map((provider) => {
              const publicProvider = publicProviderById.get(provider.id);
              const providerSync = syncByProviderId.get(provider.id);
              const secretRef = secretRefs[provider.id] ?? provider.defaultSecretRef ?? "";
              const secretChanged = secretRef.trim() !== (provider.defaultSecretRef ?? "");
              const isChecking = pendingAction === `provider:check:${provider.id}`;
              const isDiscovering = pendingAction === `provider:discover:${provider.id}`;
              const isUpdating = pendingAction === `provider:update:${provider.id}`;

              return (
              <tr className="hover:bg-bg-hover" key={provider.id}>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {provider.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                    {provider.driverKey}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      className="ui-input h-9 w-[220px] px-3 font-mono text-xs"
                      onChange={(event) =>
                        setSecretRefs((current) => ({
                          ...current,
                          [provider.id]: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="OPENROUTER_API_KEY"
                      value={secretRef}
                    />
                    <Button
                      disabled={!secretChanged || !secretRef.trim() || isUpdating}
                      onClick={() =>
                        onUpdateProvider(provider.id, {
                          defaultSecretRef: secretRef.trim(),
                        })
                      }
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {isUpdating ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={credentialTone(provider.credentialStatus)}>
                    {provider.credentialStatus}
                  </StatusPill>
                  {provider.defaultSecretRef ? (
                    <p className="mt-1 font-mono text-[10px] text-text-muted">
                      {provider.defaultSecretRef}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={syncTone(providerSync?.status ?? "never_synced")}>
                    {providerSync?.status ?? "never_synced"}
                  </StatusPill>
                  <p className="mt-1 text-[10px] text-text-muted">
                    {providerSync?.lastSuccessAt
                      ? `Last success ${formatDateTime(providerSync.lastSuccessAt)}`
                      : "No successful sync yet"}
                  </p>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {publicProvider?.models.length ?? 0}
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={provider.status === "active" ? "success" : "neutral"}>
                    {provider.status}
                  </StatusPill>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      disabled={!provider.defaultSecretRef || isChecking}
                      onClick={() => onCheckCredential(provider.id)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {isChecking ? "Checking..." : "Check key"}
                    </Button>
                    <Button
                      disabled={
                        provider.status !== "active" ||
                        provider.credentialStatus !== "configured" ||
                        isDiscovering
                      }
                      onClick={() => onRunDiscovery(provider.id)}
                      size="sm"
                      type="button"
                      variant="primary"
                    >
                      {isDiscovering ? "Running..." : "Run discovery"}
                    </Button>
                    <Button
                      disabled={isUpdating}
                      onClick={() =>
                        onUpdateProvider(provider.id, {
                          status: provider.status === "active" ? "disabled" : "active",
                        })
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {provider.status === "active" ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
      {filteredProviders.length === 0 ? (
        <div className="border-t border-[color:var(--color-border-subtle)] p-5">
          <EmptyState
            title="No matching providers"
            description="Clear search or filters to return to all providers."
          />
        </div>
      ) : null}
    </section>
  );
}

function AdminUsage({
  counters,
  providers,
  registry,
  summary,
}: {
  counters: AdminModelUsageCounterListResponse;
  providers: AdminProviderListResponse;
  registry: AdminModelRegistryListResponse;
  summary: AdminModelUsageSummaryResponse;
}) {
  const registryById = new Map(registry.items.map((model) => [model.id, model]));
  const providerNames = new Map(providers.items.map((provider) => [provider.id, provider.name]));
  const successRate =
    summary.requestCount > 0
      ? `${Math.round((summary.successCount / summary.requestCount) * 100)}%`
      : "0%";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Requests" value={formatNumber(summary.requestCount)} />
        <MetricCard label="Success rate" value={successRate} />
        <MetricCard label="Fallbacks" value={formatNumber(summary.fallbackCount)} />
        <MetricCard label="Tokens" value={formatNumber(summary.totalTokens)} />
      </div>
      <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
        <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Usage counters</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Daily backend-owned counters for approved registry models.
          </p>
        </div>
        {counters.items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No usage yet"
              description="Usage appears here after chat requests are routed through approved models."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">Provider</th>
                  <th className="px-4 py-3 font-semibold">Window</th>
                  <th className="px-4 py-3 font-semibold">Requests</th>
                  <th className="px-4 py-3 font-semibold">Failures</th>
                  <th className="px-4 py-3 font-semibold">Fallbacks</th>
                  <th className="px-4 py-3 font-semibold">Latency</th>
                  <th className="px-4 py-3 font-semibold">Tokens</th>
                  <th className="px-4 py-3 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                {counters.items.map((item) => {
                  const registryModel = registryById.get(item.registryModelId);
                  return (
                    <tr className="hover:bg-bg-hover" key={item.id}>
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {registryModel?.catalog.displayName ?? item.registryModelId}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                          {item.registryModelId}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {providerNames.get(item.providerId) ?? item.providerId}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDateTime(item.bucketStart)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatNumber(item.requestCount)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatNumber(item.failureCount)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatNumber(item.fallbackCount)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {item.averageLatencyMs == null ? "No samples" : `${Math.round(item.averageLatencyMs)}ms`}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatNumber(item.totalTokens)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatUsdMicros(item.costUsdMicros)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AdminFailover({
  modelRuntimeHealth,
  onResetModelHealth,
  onResetProviderHealth,
  pendingAction,
  providerHealth,
  providers,
  registry,
  routingAttempts,
  usageSummary,
}: {
  modelRuntimeHealth: AdminModelRuntimeHealthListResponse;
  onResetModelHealth: (registryModelId: string) => void;
  onResetProviderHealth: (providerId: string) => void;
  pendingAction: string | null;
  providerHealth: AdminProviderHealthListResponse;
  providers: AdminProviderListResponse;
  registry: AdminModelRegistryListResponse;
  routingAttempts: AdminRoutingAttemptsResponse;
  usageSummary: AdminModelUsageSummaryResponse;
}) {
  const providerNameById = useMemo(
    () => new Map(providers.items.map((provider) => [provider.id, provider.name])),
    [providers.items],
  );
  const registryNameById = useMemo(
    () =>
      new Map(
        registry.items.map((entry) => [
          entry.id,
          {
            modelName: entry.catalog.displayName,
            providerName:
              providerNameById.get(entry.catalog.providerId) ?? entry.catalog.providerId,
          },
        ]),
      ),
    [providerNameById, registry.items],
  );
  const unhealthyProviders = providerHealth.items.filter(
    (item) => item.status !== "healthy",
  );
  const unhealthyModels = modelRuntimeHealth.items.filter(
    (item) => item.status !== "healthy",
  );
  const selectedAttempts = routingAttempts.items.filter(
    (item) => item.status === "selected",
  ).length;
  const blockedAttempts = routingAttempts.items.length - selectedAttempts;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Routing attempts" value={formatNumber(routingAttempts.total)} />
        <MetricCard label="Selected" value={formatNumber(selectedAttempts)} />
        <MetricCard label="Blocked" value={formatNumber(blockedAttempts)} />
        <MetricCard
          label="Avg latency"
          value={
            usageSummary.averageLatencyMs == null
              ? "n/a"
              : `${Math.round(usageSummary.averageLatencyMs)}ms`
          }
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <HealthPanel
          emptyDescription="Provider health appears after checks or routing activity."
          items={providerHealth.items}
          nameForId={(providerId) => providerNameById.get(providerId) ?? providerId}
          onReset={onResetProviderHealth}
          pendingAction={pendingAction}
          resetPrefix="provider-health:reset"
          title="Provider health"
          type="provider"
        />
        <HealthPanel
          emptyDescription="Model runtime health appears after routing or health checks."
          items={modelRuntimeHealth.items}
          nameForId={(registryModelId) =>
            registryNameById.get(registryModelId)?.modelName ?? registryModelId
          }
          onReset={onResetModelHealth}
          pendingAction={pendingAction}
          resetPrefix="model-health:reset"
          title="Model runtime health"
          type="model"
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
        <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Recent routing attempts</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Showing {routingAttempts.items.length} of {routingAttempts.total} request-time
            routing decisions.
          </p>
        </div>
        {routingAttempts.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No routing attempts yet"
              description="Send a chat message to create eligibility and routing records."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Decision</th>
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold">Eligible</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
                {routingAttempts.items.map((attempt) => {
                  const registryModel = attempt.registryModelId
                    ? registryNameById.get(attempt.registryModelId)
                    : null;
                  return (
                    <tr className="hover:bg-bg-hover" key={attempt.id}>
                      <td className="px-4 py-3 font-mono text-[10px] text-text-secondary">
                        {formatDateTime(attempt.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={attempt.status === "selected" ? "success" : "error"}>
                          {attempt.status.replace(/_/g, " ")}
                        </StatusPill>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {registryModel?.modelName ?? "No model selected"}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-text-muted">
                          {registryModel?.providerName ?? attempt.mode}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-text-secondary">
                        {attempt.eligibleCount} yes / {attempt.ineligibleCount} no
                      </td>
                      <td className="max-w-[220px] px-4 py-3 text-text-secondary">
                        <span className="block truncate">
                          {attempt.reasonMessage ?? attempt.reasonCode ?? "Selected"}
                        </span>
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <code className="block truncate rounded border border-[color:var(--color-border-subtle)] bg-bg-hover px-2 py-1 font-mono text-[10px] text-text-muted">
                          {attempt.requestId}
                        </code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(unhealthyProviders.length > 0 || unhealthyModels.length > 0) ? (
        <p className="text-xs text-text-muted">
          Attention: {unhealthyProviders.length} provider health record(s) and{" "}
          {unhealthyModels.length} model health record(s) are not healthy.
        </p>
      ) : null}
    </div>
  );
}

function HealthPanel({
  emptyDescription,
  items,
  nameForId,
  onReset,
  pendingAction,
  resetPrefix,
  title,
  type,
}: {
  emptyDescription: string;
  items: Array<AdminProviderHealthItem | AdminModelRuntimeHealthItem>;
  nameForId: (id: string) => string;
  onReset: (id: string) => void;
  pendingAction: string | null;
  resetPrefix: string;
  title: string;
  type: "provider" | "model";
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Reset stale cooldowns only after the underlying issue has been resolved.
        </p>
      </div>
      {items.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No health records" description={emptyDescription} />
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--color-border-subtle)]">
          {items.slice(0, 8).map((item) => {
            const id = type === "provider"
              ? (item as AdminProviderHealthItem).providerId
              : (item as AdminModelRuntimeHealthItem).registryModelId;
            const isResetting = pendingAction === `${resetPrefix}:${id}`;
            return (
              <div className="flex items-center justify-between gap-3 px-4 py-3" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {nameForId(id)}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-text-muted">
                    {item.reason ?? item.lastFailureCode ?? "No failure reason recorded"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone={healthTone(item.status)}>
                    {item.status.replace(/_/g, " ")}
                  </StatusPill>
                  <Button
                    disabled={item.status === "healthy" || isResetting}
                    onClick={() => onReset(id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {isResetting ? "Resetting..." : "Reset"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function credentialTone(status: AdminProviderItem["credentialStatus"]) {
  if (status === "configured") return "success";
  if (status === "missing" || status === "invalid") return "error";
  return "neutral";
}

function healthTone(
  status: AdminProviderHealthItem["status"] | AdminModelRuntimeHealthItem["status"],
) {
  if (status === "healthy") return "success";
  if (status === "degraded" || status === "rate_limited" || status === "open_circuit") {
    return "warning";
  }
  if (status === "unknown") return "neutral";
  return "error";
}

function syncTone(status: AdminProviderSyncStatusItem["status"]) {
  if (status === "succeeded") return "success";
  if (status === "failed") return "error";
  if (status === "syncing") return "info";
  return "neutral";
}

function latestSyncSuccess(items: AdminProviderSyncStatusItem[]) {
  return items.reduce<string | null>((latest, item) => {
    if (!item.lastSuccessAt) return latest;
    if (!latest) return item.lastSuccessAt;
    return new Date(item.lastSuccessAt).getTime() > new Date(latest).getTime()
      ? item.lastSuccessAt
      : latest;
  }, null);
}

function formatCapabilities(capabilities: {
  chat: boolean;
  agent: boolean;
  vision: boolean;
  toolUse: boolean;
  jsonMode: boolean;
}) {
  return [
    capabilities.chat ? "chat" : null,
    capabilities.agent ? "agent" : null,
    capabilities.vision ? "vision" : null,
    capabilities.toolUse ? "tools" : null,
    capabilities.jsonMode ? "json" : null,
  ].filter((item): item is string => Boolean(item));
}

function AdminSettings() {
  const settingsGroups = [
    {
      eyebrow: "Marketplace",
      title: "Free model sync policy",
      items: [
        {
          label: "Startup sync",
          value: "FREE_MARKETPLACE_SYNC_ON_STARTUP",
          detail: "Set to true when the backend should refresh the free catalog during boot.",
        },
        {
          label: "Interval sync",
          value: "FREE_MARKETPLACE_SYNC_INTERVAL_MS",
          detail: "Use a conservative interval so OpenRouter catalog refreshes do not create noisy background traffic.",
        },
      ],
    },
    {
      eyebrow: "Routing safety",
      title: "Production defaults",
      items: [
        {
          label: "Customer chat",
          value: "Active registry models only",
          detail: "The chat selector should never read hardcoded model names or disabled models.",
        },
        {
          label: "Free models",
          value: "Best-effort routing",
          detail: "Keep sensitive workspace context off free models until a dedicated policy toggle is introduced.",
        },
      ],
    },
    {
      eyebrow: "Operations",
      title: "Admin checklist",
      items: [
        {
          label: "Before tester handoff",
          value: "Verify at least one eligible model",
          detail: "Open Overview and Routing after a test chat to confirm attempts and health signals are recorded.",
        },
        {
          label: "When provider errors rise",
          value: "Review model priority and cooldowns",
          detail: "Use Models, Providers, and Routing to disable failing paths or fix credentials before customers hit a full outage.",
        },
      ],
    },
    {
      eyebrow: "Access",
      title: "Role boundaries",
      items: [
        {
          label: "Admin console",
          value: "Admin role required",
          detail: "Customers are redirected away from /admin and should use /dashboard for their workspace.",
        },
        {
          label: "Settings ownership",
          value: "Environment-first",
          detail: "Secrets and production defaults stay in backend configuration, not browser local storage.",
        },
      ],
    },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Operational configuration</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Secrets and production defaults remain backend-owned for auditability.
        </p>
      </div>
      <div className="divide-y divide-[color:var(--color-border-subtle)]">
        {settingsGroups.map((group) => (
          <div className="grid gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)]" key={group.title}>
            <div>
              <p className="ui-section-label">{group.eyebrow}</p>
              <h3 className="mt-2 text-sm font-semibold text-text-primary">{group.title}</h3>
            </div>
            <div className="space-y-3">
              {group.items.map((item) => (
                <div
                  className="grid gap-2 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] px-3 py-3 md:grid-cols-[minmax(0,0.8fr)_minmax(220px,1fr)] md:items-start"
                  key={`${group.title}:${item.label}`}
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{item.label}</p>
                    <code className="mt-1 inline-block rounded bg-[color:var(--color-bg-hover)] px-2 py-1 text-[11px] text-text-secondary">
                      {item.value}
                    </code>
                  </div>
                  <p className="text-xs leading-5 text-text-secondary">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Panel className="rounded-lg p-4">
      <p className="ui-section-label">{label}</p>
      <p className="mt-2 font-headline text-2xl font-semibold tracking-[-0.03em] text-text-primary">{value}</p>
    </Panel>
  );
}

function MetricInline({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUsdMicros(value: number) {
  return `$${(value / 1_000_000).toFixed(4)}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
