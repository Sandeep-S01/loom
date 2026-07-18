"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
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
  createModel,
  deleteModel,
  disableFreeMarketplaceModel,
  enableFreeMarketplaceModel,
  getDashboard,
  getModelAnalytics,
  getProvidersStatus,
  getSession,
  listFailoverAttempts,
  listFreeMarketplaceModels,
  listModels,
  logout,
  syncFreeMarketplaceModels,
  updateModel,
} from "../lib/api";
import type {
  DashboardResponse,
  CreateModelRequest,
  FreeMarketplaceResponse,
  ModelAnalyticsResponse,
  ModelFailoverAttemptsResponse,
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

type AttemptStatusFilter =
  | "success"
  | "failed"
  | "skipped_cooldown"
  | "blocked_quota";

interface FailoverFilters {
  page: number;
  pageSize: number;
  modelId: string;
  status: "" | AttemptStatusFilter;
  from: string;
  to: string;
}

const INITIAL_FAILOVER_FILTERS: FailoverFilters = {
  page: 1,
  pageSize: 25,
  modelId: "",
  status: "",
  from: "",
  to: "",
};

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
  marketplace: "Sync and enable free catalog models for backend routing.",
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
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [marketplace, setMarketplace] = useState<FreeMarketplaceResponse>({
    models: [],
    lastSyncedAt: null,
  });
  const [analytics, setAnalytics] = useState<ModelAnalyticsResponse>({
    summary: [],
    series: [],
  });
  const [failoverAttempts, setFailoverAttempts] =
    useState<ModelFailoverAttemptsResponse>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
      hasNextPage: false,
    });
  const [failoverFilters, setFailoverFilters] =
    useState<FailoverFilters>(INITIAL_FAILOVER_FILTERS);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadAdminData = useCallback(async (filters: FailoverFilters) => {
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
      modelsResponse,
      marketplaceResponse,
      analyticsResponse,
      failoverAttemptsResponse,
    ] = await Promise.all([
      getDashboard(),
      getProvidersStatus(),
      listModels({ includeDisabled: true }),
      listFreeMarketplaceModels(),
      getModelAnalytics({
        from: weekAgo.toISOString(),
        to: now.toISOString(),
        granularity: "day",
      }),
      listFailoverAttempts(toFailoverQuery(filters)),
    ]);

    setSession(sessionResponse);
    setDashboard(dashboardResponse);
    setProviders(providersResponse);
    setModels(modelsResponse.models);
    setMarketplace(marketplaceResponse);
    setAnalytics(analyticsResponse);
    setFailoverAttempts(failoverAttemptsResponse);
  }, []);

  async function loadFailoverData(nextFilters: FailoverFilters) {
    setPendingAction("failover:query");
    setError(null);
    setFailoverFilters(nextFilters);
    try {
      const response = await listFailoverAttempts(toFailoverQuery(nextFilters));
      setFailoverAttempts(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load failover attempts.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    loadAdminData(INITIAL_FAILOVER_FILTERS)
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
    const usage = analytics.summary.reduce(
      (total, item) => ({
        requests: total.requests + item.requestCount,
        errors: total.errors + item.errorCount,
        tokens: total.tokens + item.totalTokens,
        cost: total.cost + item.costUsdMicros,
      }),
      { requests: 0, errors: 0, tokens: 0, cost: 0 },
    );
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
      freeModels: marketplace.models.length,
      openCircuitModels: openCircuitModels.length,
      configuredProviders,
      providerCount,
      requests: usage.requests,
      errors: usage.errors,
      tokens: usage.tokens,
      costUsdMicros: usage.cost,
      lastMarketplaceSync: marketplace.lastSyncedAt,
      warningCount,
    };
  }, [analytics.summary, dashboard, marketplace, models, providers]);

  async function runAction(actionId: string, action: () => Promise<void>) {
    setPendingAction(actionId);
    setError(null);
    try {
      await action();
      await loadAdminData(failoverFilters);
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
              onClick={() =>
                void runAction("refresh", () => loadAdminData(failoverFilters))
              }
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
              models={models}
              providers={providers}
              onCreate={(payload) =>
                runAction("create:model", async () => {
                  await createModel(payload);
                })
              }
              onDelete={(modelId) =>
                runAction(`delete:${modelId}`, async () => {
                  await deleteModel(modelId);
                })
              }
              onToggle={(model) =>
                runAction(`toggle:${model.id}`, async () => {
                  await updateModel(model.id, {
                    adminStatus:
                      model.adminStatus === "active" ? "disabled" : "active",
                  });
                })
              }
              pendingAction={pendingAction}
            />
          ) : null}
          {activeSection === "marketplace" ? (
            <AdminMarketplace
              marketplace={marketplace}
              onDisable={(modelId) =>
                runAction(`market:disable:${modelId}`, async () => {
                  await disableFreeMarketplaceModel(modelId);
                })
              }
              onEnable={(modelId) =>
                runAction(`market:enable:${modelId}`, async () => {
                  await enableFreeMarketplaceModel(modelId);
                })
              }
              onSync={() =>
                runAction("market:sync", async () => {
                  await syncFreeMarketplaceModels();
                })
              }
              pendingAction={pendingAction}
            />
          ) : null}
          {activeSection === "providers" ? (
            <AdminProviders providers={providers} />
          ) : null}
          {activeSection === "usage" ? (
            <AdminUsage analytics={analytics} models={models} />
          ) : null}
          {activeSection === "failover" ? (
            <AdminFailover
              attempts={failoverAttempts}
              filters={failoverFilters}
              isLoading={pendingAction === "failover:query"}
              models={models}
              onChangeFilters={(nextFilters) => void loadFailoverData(nextFilters)}
            />
          ) : null}
          {activeSection === "settings" ? <AdminSettings /> : null}
        </div>
      </section>
    </div>
  );
}

function toFailoverQuery(filters: FailoverFilters) {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    modelId: filters.modelId || undefined,
    status: filters.status || undefined,
    from: filters.from ? dateStartIso(filters.from) : undefined,
    to: filters.to ? dateEndIso(filters.to) : undefined,
  };
}

function dateStartIso(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toISOString();
}

function dateEndIso(dateValue: string) {
  return new Date(`${dateValue}T23:59:59.999`).toISOString();
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
  models,
  providers,
  onCreate,
  onDelete,
  onToggle,
  pendingAction,
}: {
  models: ModelRegistryItem[];
  providers: ProvidersResponse | null;
  onCreate: (payload: CreateModelRequest) => void;
  onDelete: (modelId: string) => void;
  onToggle: (model: ModelRegistryItem) => void;
  pendingAction: string | null;
}) {
  const [query, setQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [providerModelId, setProviderModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [secretRef, setSecretRef] = useState("");
  const [priorityRank, setPriorityRank] = useState("1");
  const [rpmLimit, setRpmLimit] = useState("");
  const [tokensLimit, setTokensLimit] = useState("");
  const [adminStatus, setAdminStatus] = useState<"active" | "disabled">("active");
  const [supportsChat, setSupportsChat] = useState(true);
  const [supportsAgent, setSupportsAgent] = useState(false);
  const [supportsVision, setSupportsVision] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const providerEntries = providers?.providers ?? [];
  const selectedProviderId = providerId || providerEntries[0]?.id || "";
  const filteredModels = useMemo(
    () =>
      models.filter((model) => {
        const matchesStatus =
          statusFilter === "all" || model.effectiveStatus === statusFilter;
        const searchable = [
          model.displayName,
          model.providerName,
          model.providerModelId,
          model.effectiveStatus,
          model.runtimeStatus,
        ]
          .join(" ")
          .toLowerCase();
        return matchesStatus && searchable.includes(query.trim().toLowerCase());
      }),
    [models, query, statusFilter],
  );

  function resetForm() {
    setProviderId("");
    setProviderModelId("");
    setDisplayName("");
    setSecretRef("");
    setPriorityRank("1");
    setRpmLimit("");
    setTokensLimit("");
    setAdminStatus("active");
    setSupportsChat(true);
    setSupportsAgent(false);
    setSupportsVision(false);
  }

  function handleCreateModel() {
    onCreate({
      providerId: selectedProviderId,
      providerModelId: providerModelId.trim(),
      displayName: displayName.trim(),
      secretRef: secretRef.trim() || null,
      priorityRank: Number(priorityRank) || 1,
      supportsChat,
      supportsAgent,
      supportsVision,
      adminStatus,
      requestsPerMinuteLimit: rpmLimit.trim() ? Number(rpmLimit) : null,
      tokensPerDayLimit: tokensLimit.trim() ? Number(tokensLimit) : null,
      costInputPer1mUsdMicros: null,
      costOutputPer1mUsdMicros: null,
    });
    resetForm();
    setIsAddOpen(false);
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="flex flex-col gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Model registry</h2>
          <p className="mt-1 text-xs text-text-secondary">
            {filteredModels.length} of {models.length} models shown.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[220px_140px_auto]">
          <input
            className="ui-input h-9 px-3 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search models"
            value={query}
          />
          <select
            className="ui-input h-9 px-3 text-sm"
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | "active" | "disabled")
            }
            value={statusFilter}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <Button
            disabled={providerEntries.length === 0}
            onClick={() => setIsAddOpen((current) => !current)}
            size="sm"
            type="button"
            variant="primary"
          >
            Add model
          </Button>
        </div>
      </div>
      {isAddOpen ? (
        <div className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/40 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-text-secondary">Provider</span>
              <select
                className="ui-input h-10 w-full px-3 text-sm"
                onChange={(event) => setProviderId(event.target.value)}
                value={selectedProviderId}
              >
                {providerEntries.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-text-secondary">Provider model ID</span>
              <input
                className="ui-input h-10 w-full px-3 text-sm"
                onChange={(event) => setProviderModelId(event.target.value)}
                placeholder="openai/gpt-4o-mini"
                value={providerModelId}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-text-secondary">Display name</span>
              <input
                className="ui-input h-10 w-full px-3 text-sm"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="GPT 4o Mini"
                value={displayName}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-text-secondary">Secret ref</span>
              <input
                className="ui-input h-10 w-full px-3 text-sm"
                onChange={(event) => setSecretRef(event.target.value.toUpperCase())}
                placeholder="OPENROUTER_API_KEY"
                value={secretRef}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-text-secondary">Priority</span>
              <input
                className="ui-input h-10 w-full px-3 text-sm"
                inputMode="numeric"
                onChange={(event) => setPriorityRank(event.target.value)}
                value={priorityRank}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-text-secondary">Requests / minute</span>
              <input
                className="ui-input h-10 w-full px-3 text-sm"
                inputMode="numeric"
                onChange={(event) => setRpmLimit(event.target.value)}
                placeholder="Optional"
                value={rpmLimit}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-text-secondary">Tokens / day</span>
              <input
                className="ui-input h-10 w-full px-3 text-sm"
                inputMode="numeric"
                onChange={(event) => setTokensLimit(event.target.value)}
                placeholder="Optional"
                value={tokensLimit}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-medium text-text-secondary">Status</span>
              <select
                className="ui-input h-10 w-full px-3 text-sm"
                onChange={(event) =>
                  setAdminStatus(event.target.value as "active" | "disabled")
                }
                value={adminStatus}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-4">
              {[
                ["Chat", supportsChat, setSupportsChat],
                ["Agent", supportsAgent, setSupportsAgent],
                ["Vision", supportsVision, setSupportsVision],
              ].map(([label, checked, setter]) => (
                <label className="flex items-center gap-2 text-sm text-text-secondary" key={label as string}>
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
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  resetForm();
                  setIsAddOpen(false);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  pendingAction === "create:model" ||
                  !selectedProviderId ||
                  !providerModelId.trim() ||
                  !displayName.trim()
                }
                onClick={handleCreateModel}
                size="sm"
                type="button"
                variant="primary"
              >
                {pendingAction === "create:model" ? "Adding..." : "Create model"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {models.length === 0 ? (
        <div className="p-5">
          <EmptyState
            description="Add a backend-managed model to make it available for customer chat routing."
            title="No models configured"
          />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Model</th>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Cost</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
            {filteredModels.map((model) => (
              <tr className="hover:bg-bg-hover" key={model.id}>
                <td className="max-w-[260px] px-4 py-3">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {model.displayName}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                    {model.providerModelId}
                  </p>
                </td>
                <td className="px-4 py-3 text-text-secondary">{model.providerName}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill tone={model.effectiveStatus === "active" ? "success" : "neutral"}>
                      {model.effectiveStatus}
                    </StatusPill>
                    {model.runtimeStatus !== "healthy" ? (
                      <StatusPill tone="warning">{model.runtimeStatus}</StatusPill>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={model.costTier === "free" ? "success" : "warning"}>
                    {model.costTier}
                  </StatusPill>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      disabled={pendingAction === `toggle:${model.id}`}
                      onClick={() => onToggle(model)}
                      size="sm"
                      type="button"
                      variant={model.adminStatus === "active" ? "secondary" : "primary"}
                    >
                      {model.adminStatus === "active" ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      disabled={pendingAction === `delete:${model.id}`}
                      onClick={() => onDelete(model.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredModels.length === 0 ? (
        <div className="border-t border-[color:var(--color-border-subtle)] p-5">
          <EmptyState
            title="No matching models"
            description="Clear search or filters to return to the full registry."
          />
        </div>
      ) : null}
    </section>
  );
}

function AdminMarketplace({
  marketplace,
  onDisable,
  onEnable,
  onSync,
  pendingAction,
}: {
  marketplace: FreeMarketplaceResponse;
  onDisable: (modelId: string) => void;
  onEnable: (modelId: string) => void;
  onSync: () => void;
  pendingAction: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="flex flex-col gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Free model catalog</h2>
          <p className="mt-1 text-xs text-text-secondary">
            {marketplace.models.length} models synced. Last sync{" "}
            {marketplace.lastSyncedAt ? formatDateTime(marketplace.lastSyncedAt) : "never"}.
          </p>
        </div>
          <Button
            disabled={pendingAction === "market:sync"}
            onClick={onSync}
            size="sm"
            type="button"
            variant="primary"
          >
            Sync free models
          </Button>
      </div>
      {marketplace.models.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No catalog models synced"
            description="Sync the catalog to review available free models."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Provider</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Credential</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
              {marketplace.models.map((model) => {
                const enabled = model.adminStatus === "active";
                return (
                  <tr className="hover:bg-bg-hover" key={model.id}>
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {model.displayName}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                        {model.owner ? `${model.owner} / ` : ""}
                        {model.providerModelId}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{model.providerName}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={enabled ? "success" : "neutral"}>
                        {enabled ? "Enabled" : model.marketplaceStatus ?? "Available"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={model.secretConfigured ? "success" : "error"}>
                        {model.secretConfigured ? "Ready" : "Key required"}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        disabled={
                          pendingAction === `market:enable:${model.id}` ||
                          pendingAction === `market:disable:${model.id}` ||
                          !model.secretConfigured
                        }
                        onClick={() => (enabled ? onDisable(model.id) : onEnable(model.id))}
                        size="sm"
                        type="button"
                        variant={enabled ? "secondary" : "primary"}
                      >
                        {enabled ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminProviders({ providers }: { providers: ProvidersResponse | null }) {
  const entries = providers?.providers ?? [];
  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Provider health</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Credentials stay backend-owned; this screen shows readiness only.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Models</th>
              <th className="px-4 py-3 font-semibold">Credential</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
            {entries.map((provider) => (
              <tr className="hover:bg-bg-hover" key={provider.id}>
                <td className="px-4 py-3 text-sm font-medium text-text-primary">
                  {provider.name}
                </td>
                <td className="px-4 py-3 text-text-secondary">{provider.models.length}</td>
                <td className="px-4 py-3">
                  <StatusPill tone={provider.keyConfigured ? "success" : "error"}>
                    {provider.keyConfigured ? "Configured" : "Missing"}
                  </StatusPill>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={provider.keyConfigured ? "success" : "error"}>
                    {provider.status}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminUsage({
  analytics,
  models,
}: {
  analytics: ModelAnalyticsResponse;
  models: ModelRegistryItem[];
}) {
  const modelNames = new Map(models.map((model) => [model.id, model.displayName]));
  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Usage by model</h2>
        <p className="mt-1 text-xs text-text-secondary">Current analytics window from the backend.</p>
      </div>
      {analytics.summary.length === 0 ? (
        <div className="p-5">
        <EmptyState title="No usage yet" description="Model usage appears after chat requests." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.14em] text-text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Requests</th>
                <th className="px-4 py-3 font-semibold">Errors</th>
                <th className="px-4 py-3 font-semibold">Tokens</th>
                <th className="px-4 py-3 font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border-subtle)]">
              {analytics.summary.map((item) => (
                <tr className="hover:bg-bg-hover" key={item.modelId}>
                  <td className="max-w-[280px] px-4 py-3">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {modelNames.get(item.modelId) ?? item.modelId}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                      {item.modelId}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatNumber(item.requestCount)}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatNumber(item.errorCount)}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatNumber(item.totalTokens)}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatUsdMicros(item.costUsdMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminFailover({
  attempts,
  filters,
  isLoading,
  models,
  onChangeFilters,
}: {
  attempts: ModelFailoverAttemptsResponse;
  filters: FailoverFilters;
  isLoading: boolean;
  models: ModelRegistryItem[];
  onChangeFilters: (filters: FailoverFilters) => void;
}) {
  const pageStart = attempts.total === 0 ? 0 : (attempts.page - 1) * attempts.pageSize + 1;
  const pageEnd = Math.min(attempts.total, attempts.page * attempts.pageSize);

  function updateFilters(patch: Partial<FailoverFilters>) {
    onChangeFilters({
      ...filters,
      ...patch,
    });
  }

  const inputClassName =
    "ui-input h-9 w-full px-3 text-sm placeholder:text-text-muted disabled:cursor-not-allowed disabled:bg-bg-hover disabled:text-text-muted";
  const labelClassName =
    "mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted";
  const paginationButtonClassName =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[color:var(--color-border-subtle)] bg-surface px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface disabled:hover:text-text-secondary";

  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-surface">
      <div className="border-b border-[color:var(--color-border-subtle)] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Provider attempts
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Showing {pageStart}-{pageEnd} of {attempts.total} attempts.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,0.8fr)_auto]">
          <label>
            <span className={labelClassName}>Model</span>
            <select
              className={inputClassName}
              disabled={isLoading}
              onChange={(event) => updateFilters({ modelId: event.target.value, page: 1 })}
              value={filters.modelId}
            >
              <option value="">All models</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClassName}>Status</span>
            <select
              className={inputClassName}
              disabled={isLoading}
              onChange={(event) =>
                updateFilters({
                  status: event.target.value as FailoverFilters["status"],
                  page: 1,
                })
              }
              value={filters.status}
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="skipped_cooldown">Skipped cooldown</option>
              <option value="blocked_quota">Blocked quota</option>
            </select>
          </label>
          <label>
            <span className={labelClassName}>From</span>
            <input
              className={inputClassName}
              disabled={isLoading}
              onChange={(event) => updateFilters({ from: event.target.value, page: 1 })}
              type="date"
              value={filters.from}
            />
          </label>
          <label>
            <span className={labelClassName}>To</span>
            <input
              className={inputClassName}
              disabled={isLoading}
              onChange={(event) => updateFilters({ to: event.target.value, page: 1 })}
              type="date"
              value={filters.to}
            />
          </label>
          <label>
            <span className={labelClassName}>Page Size</span>
            <select
              className={inputClassName}
              disabled={isLoading}
              onChange={(event) =>
                updateFilters({ pageSize: Number(event.target.value), page: 1 })
              }
              value={String(filters.pageSize)}
            >
              <option value="10">10 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </label>
          <button
            className="flex h-9 items-center justify-center rounded-md px-3 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={() =>
              onChangeFilters({
                page: 1,
                pageSize: 25,
                modelId: "",
                status: "",
                from: "",
                to: "",
              })
            }
            type="button"
          >
            Clear filters
          </button>
        </div>
      </div>
      {attempts.items.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No matching provider attempts"
            description="Try widening the filters or send a chat message to create new routing attempts."
          />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-xs">
          <thead className="border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/60 text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Model</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Attempt</th>
              <th className="px-4 py-3 font-semibold">Failure</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
              <th className="px-4 py-3 font-semibold">Tokens</th>
              <th className="px-4 py-3 font-semibold">Trace</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border-subtle)] bg-surface">
            {attempts.items.map((attempt) => (
              <tr key={attempt.id} className="hover:bg-bg-hover">
                <td className="px-4 py-3 text-text-secondary font-mono text-[10px] tracking-wide">
                  {formatDateTime(attempt.createdAt)}
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate font-medium text-text-primary">
                    {attempt.modelName}
                  </p>
                  <p className="truncate text-[9px] text-text-muted font-mono uppercase tracking-wider mt-0.5">
                    {attempt.providerName} {"//"} {attempt.providerModelId}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={statusTone(attempt.status)}>
                    {attempt.status.replace(/_/g, " ")}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill tone={attempt.wasFailover ? "warning" : "neutral"}>
                      #{attempt.attemptNo}
                    </StatusPill>
                    {attempt.wasManualSelection ? (
                      <StatusPill tone="info">Manual</StatusPill>
                    ) : null}
                    {attempt.wasFailover ? (
                      <StatusPill tone="warning">Failover</StatusPill>
                    ) : null}
                  </div>
                </td>
                <td className="max-w-[160px] px-4 py-3 text-text-secondary font-mono text-[10px] uppercase">
                  <span className="block truncate">
                    {attempt.failureCode ?? "None"}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary font-mono text-[10px]">
                  {attempt.latencyMs == null ? "n/a" : `${attempt.latencyMs}ms`}
                </td>
                <td className="px-4 py-3 text-text-secondary font-mono text-[10px]">
                  <div>{formatNumber(attempt.totalTokens)}</div>
                  <div className="text-[9px] text-text-muted tracking-wide mt-0.5">
                    {formatUsdMicros(attempt.costUsdMicros)}
                  </div>
                </td>
                <td className="max-w-[180px] px-4 py-3">
                  <code className="block truncate rounded bg-[color:var(--color-bg-hover)] px-2 py-1 text-[10px] text-text-muted border border-[color:var(--color-border-subtle)] font-mono">
                    {attempt.idempotencyKey}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)]/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-muted">
          {attempts.hasNextPage
            ? "More attempts are available on the next page."
            : "End of results for the current filters."}
        </p>
        <div className="flex items-center gap-2">
          <button
            className={paginationButtonClassName}
            disabled={attempts.page <= 1 || isLoading}
            onClick={() => updateFilters({ page: Math.max(1, filters.page - 1) })}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={14} strokeWidth={1.5} />
            Previous
          </button>
          <span className="inline-flex h-8 items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel-muted)] px-3 text-xs font-medium text-text-primary">
            Page {attempts.page}
          </span>
          <button
            className={paginationButtonClassName}
            disabled={!attempts.hasNextPage || isLoading}
            onClick={() => updateFilters({ page: filters.page + 1 })}
            type="button"
          >
            Next
            <ChevronRight aria-hidden="true" size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </section>
  );
}

function statusTone(status: ModelFailoverAttemptsResponse["items"][number]["status"]) {
  if (status === "success") return "success";
  if (status === "failed") return "error";
  if (status === "blocked_quota") return "warning";
  return "neutral";
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
          detail: "Open Overview and Failover Logs after a test chat to confirm routing attempts are recorded.",
        },
        {
          label: "When provider errors rise",
          value: "Review model priority and cooldowns",
          detail: "Disable failing models or adjust provider credentials before customers hit a full outage.",
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
