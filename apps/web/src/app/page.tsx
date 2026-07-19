import Link from "next/link";
import {
  ArrowDown,
  Sliders,
  GitFork,
  Database,
} from "lucide-react";
import { LoomLogo } from "../components/loom-logo";

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-[color:var(--color-bg-base)] text-text-primary grid-bg">
      <header className="fixed top-0 w-full z-50 border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)]/92 backdrop-blur-sm">
        <nav className="public-container flex justify-between items-center gap-3 py-4 sm:px-5">
          <Link href="/" className="public-focus inline-flex items-center" prefetch={false}>
            <LoomLogo
              ariaLabel="Loom home"
              className="select-none"
              textClassName="h-6 sm:h-[25px] w-auto"
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-6">
            <Link className="public-focus landing-header-link text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] sm:tracking-widest text-text-secondary hover:text-[color:var(--color-accent-hover)] transition-colors" href="/login" prefetch={false}>
              Sign in
            </Link>
            <Link className="public-focus landing-header-link landing-primary-cta text-[11px] sm:text-xs font-medium uppercase tracking-[0.16em] sm:tracking-widest px-3 py-2 sm:px-4 rounded-md transition-colors" href="/register" prefetch={false}>
              Create account
            </Link>
          </div>
        </nav>
      </header>

      <div className="public-container pt-24 sm:px-5">
        <section className="grid grid-cols-12 gap-6 md:gap-8 mb-16 items-start pt-6 md:mb-24 md:pt-10">
          <div className="col-span-12 lg:col-span-7 pr-0 lg:pr-12">
            <div className="inline-flex items-center gap-2 mb-6 border border-[color:var(--color-border-subtle)] px-3 py-1 bg-[color:var(--color-surface-panel)] rounded-full">
              <span className="w-1.5 h-1.5 bg-[color:var(--color-accent)] rounded-full pulse-dot"></span>
              <span className="font-label text-[11px] text-text-secondary uppercase tracking-[0.12em]">
                Admin-controlled AI workspace
              </span>
            </div>

            <h1 className="font-headline text-[2.2rem] sm:text-5xl md:text-6xl font-normal text-text-primary leading-[1.02] sm:leading-[1.08] tracking-[-0.04em] mb-6 sm:mb-8">
              AI chat with approved models
              <br />
              and local workspace context.
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-text-secondary max-w-xl leading-relaxed mb-8 sm:mb-10">
              Loom gives customers one simple workspace for chat while admins control
              providers, approved models, routing, fallback, and availability from the backend.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link href="/register" className="public-focus landing-primary-cta inline-flex items-center justify-center font-medium text-sm px-6 sm:px-10 py-4 rounded-md text-center transition-colors" prefetch={false}>
                Start testing Loom
              </Link>
              <Link href="/login" className="public-focus landing-secondary-cta inline-flex items-center justify-center border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-panel)] text-text-primary font-medium text-sm px-6 sm:px-10 py-4 rounded-md text-center hover:bg-[color:var(--color-bg-hover)] transition-colors" prefetch={false}>
                Sign in
              </Link>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 lg:mt-6">
            <div className="tech-card overflow-hidden border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)]">
              <div className="bg-[color:var(--color-canvas-soft,var(--color-bg-hover))] px-4 py-3 flex justify-between items-center border-b border-[color:var(--color-border-subtle)]">
                <div className="flex gap-4 items-center">
                  <span className="font-mono text-[10px] text-text-secondary">CHAT REQUEST FLOW</span>
                  <div className="h-px w-8 bg-[color:var(--color-border-subtle)]"></div>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 border border-text-secondary/30"></div>
                  <div className="w-1.5 h-1.5 border border-text-secondary/30"></div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-hover)] rounded-md">
                    <div className="text-[9px] uppercase font-mono text-text-secondary mb-1">Registry</div>
                    <div className="font-mono text-sm text-text-primary font-bold">Approved models</div>
                  </div>
                  <div className="p-4 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-hover)] rounded-md">
                    <div className="text-[9px] uppercase font-mono text-text-secondary mb-1">Policy</div>
                    <div className="font-mono text-sm text-[color:var(--color-accent)] font-bold">Backend control</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
                    How a request is handled
                  </span>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 p-3 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-hover)] rounded-md animate-trace-1">
                      <span className="font-mono text-[10px] text-[color:var(--color-accent)]">01</span>
                      <span className="font-mono text-xs text-text-secondary">REQUEST:</span>
                      <span className="font-mono text-xs text-text-primary">&quot;Help me review this change&quot;</span>
                    </div>

                    <div className="flex justify-center py-0.5 animate-trace-arrow-1">
                      <ArrowDown className="text-[color:var(--color-border-strong)] h-4 w-4" />
                    </div>

                    <div className="flex items-center gap-3 p-3 border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-panel)] rounded-md animate-trace-2">
                      <span className="font-mono text-[10px] text-[color:var(--color-accent)]">02</span>
                      <span className="font-mono text-xs text-[color:var(--color-accent)] font-bold">ELIGIBILITY:</span>
                      <span className="font-mono text-xs text-text-primary">Check approved models, policy, and health</span>
                    </div>

                    <div className="flex justify-center py-0.5 animate-trace-arrow-2">
                      <ArrowDown className="text-[color:var(--color-border-strong)] h-4 w-4" />
                    </div>

                    <div className="flex items-center gap-3 p-3 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-hover)] rounded-md animate-trace-3">
                      <span className="font-mono text-[10px] text-[color:var(--color-accent)]">03</span>
                      <span className="font-mono text-xs text-text-secondary">ROUTE:</span>
                      <span className="font-mono text-xs text-text-primary">Use a healthy model, with fallback if needed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16 md:mb-24">
          <div className="grid grid-cols-12 gap-6 md:gap-8 items-end mb-10 md:mb-12">
            <div className="col-span-12 lg:col-span-8">
              <span className="font-mono text-xs text-[color:var(--color-accent)] uppercase tracking-[0.2em] mb-4 block">
                What Loom helps you do
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary tracking-tight max-w-2xl">
                Give customers simple chat while admins control model access and reliability.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-4 lg:text-right">
              <p className="text-sm text-text-secondary leading-relaxed">
                Built for teams that need backend-owned provider credentials, approved models,
                fallback routing, and connected local context.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="tech-card min-h-[190px] md:min-h-[260px] p-6 sm:p-8 flex flex-col justify-between bg-[color:var(--color-surface-panel)]">
              <Sliders className="text-[color:var(--color-accent)] h-7 w-7" strokeWidth={1.5} />
              <div>
                <h3 className="text-xl font-bold text-text-primary mb-3">Approved model registry</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Admins approve discovered free models before customers can select or route to them.
                </p>
              </div>
            </div>

            <div className="tech-card min-h-[190px] md:min-h-[260px] p-6 sm:p-8 flex flex-col justify-between md:mt-6 bg-[color:var(--color-surface-panel)]">
              <GitFork className="text-[color:var(--color-accent)] h-7 w-7 rotate-180" strokeWidth={1.5} />
              <div>
                <h3 className="text-xl font-bold text-text-primary mb-3">Automatic routing and fallback</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Keep chats moving when an approved provider is rate limited or temporarily unavailable.
                </p>
              </div>
            </div>

            <div className="tech-card min-h-[190px] md:min-h-[260px] p-6 sm:p-8 flex flex-col justify-between bg-[color:var(--color-surface-panel)]">
              <Database className="text-[color:var(--color-accent)] h-7 w-7" strokeWidth={1.5} />
              <div>
                <h3 className="text-xl font-bold text-text-primary mb-3">Local workspace context</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Pair local folders so approved chat workflows can reference project context safely.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-8 md:gap-12 items-start mb-16 md:mb-24">
          <div className="col-span-12 lg:col-span-5 lg:sticky lg:top-32">
            <span className="font-mono text-xs text-[color:var(--color-accent)] uppercase tracking-[0.2em] mb-4 block">
              How to get started
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary tracking-tight mb-5 md:mb-6">
              Set up Loom in four simple steps.
            </h2>
            <p className="text-text-secondary mb-8 leading-relaxed">
              Create a workspace, approve free models, and let customers chat through eligible routes.
            </p>

            <div className="p-5 sm:p-6 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[10px] text-[color:var(--color-accent)] uppercase tracking-wider">
                  Customer workspace setup
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Provider keys stay backend-owned. Customers only see models approved by admins.
              </p>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-4">
            <div className="tech-card p-6 sm:p-8 group bg-[color:var(--color-surface-panel)] hover:bg-[color:var(--color-bg-hover)] transition-colors">
              <div className="flex items-start gap-6">
                <span className="font-mono text-2xl text-text-secondary group-hover:text-[color:var(--color-accent)] transition-colors">
                  01
                </span>
                <div>
                  <h4 className="text-lg font-bold text-text-primary mb-2">Create the workspace</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Open Loom and invite testers into one simple chat workspace.
                  </p>
                </div>
              </div>
            </div>

            <div className="tech-card p-6 sm:p-8 group bg-[color:var(--color-surface-panel)] hover:bg-[color:var(--color-bg-hover)] transition-colors">
              <div className="flex items-start gap-6">
                <span className="font-mono text-2xl text-text-secondary group-hover:text-[color:var(--color-accent)] transition-colors">
                  02
                </span>
                <div>
                  <h4 className="text-lg font-bold text-text-primary mb-2">Admin connects providers</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Keep provider credentials on the backend and discover available free models.
                  </p>
                </div>
              </div>
            </div>

            <div className="tech-card p-6 sm:p-8 group bg-[color:var(--color-surface-panel)] hover:bg-[color:var(--color-bg-hover)] transition-colors">
              <div className="flex items-start gap-6">
                <span className="font-mono text-2xl text-text-secondary group-hover:text-[color:var(--color-accent)] transition-colors">
                  03
                </span>
                <div>
                  <h4 className="text-lg font-bold text-text-primary mb-2">Approve eligible models</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Move discovered models into the registry and control visibility with policy.
                  </p>
                </div>
              </div>
            </div>

            <div className="tech-card p-6 sm:p-8 border-l-2 border-l-[color:var(--color-accent)] bg-[color:var(--color-surface-panel)]">
              <div className="flex items-start gap-6">
                <span className="font-mono text-2xl text-[color:var(--color-accent)] font-semibold">
                  04
                </span>
                <div>
                  <h4 className="text-lg font-bold text-text-primary mb-2">Customers start chatting</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Customers use approved models while Loom handles health checks, routing, and fallback.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16 md:mb-24 border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-hover)] p-6 sm:p-8 md:p-12 relative overflow-hidden rounded-lg">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(var(--color-border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--color-border-subtle)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

          <div className="relative z-10 grid grid-cols-12 gap-8 items-center">
            <div className="col-span-12 lg:col-span-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary mb-5 md:mb-6 tracking-tight">
                One controlled workspace for customer AI chat
              </h2>
              <p className="text-text-secondary max-w-xl text-base md:text-lg mb-0 leading-relaxed">
                Give customers a simple chat experience while your team keeps control over provider setup,
                approved models, routing policy, and connected local folders.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-4 flex justify-start lg:justify-end">
              <Link href="/register" className="public-focus landing-primary-cta inline-flex items-center justify-center font-medium text-sm px-6 sm:px-10 py-4 sm:py-5 uppercase tracking-widest rounded-md transition-colors" prefetch={false}>
                Start testing Loom
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[color:var(--color-border-subtle)]/40 bg-[color:var(--color-bg-base)] py-14">
        <div className="public-container flex flex-col md:flex-row justify-between items-start gap-10 sm:px-5">
          <div className="space-y-5">
            <LoomLogo className="select-none" textClassName="h-6 sm:h-[25px] w-auto" />
            <p className="text-sm text-text-secondary leading-relaxed max-w-sm">
              Loom is an admin-controlled AI workspace for customer chat, approved model routing,
              local context, and provider monitoring.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              className="public-focus landing-primary-cta inline-flex items-center justify-center rounded-md text-xs font-bold uppercase tracking-widest px-4 py-3 text-center transition-colors"
              href="/register"
              prefetch={false}
            >
              Start testing
            </Link>
            <Link
              className="public-focus landing-secondary-cta inline-flex items-center justify-center rounded-md border border-[color:var(--color-border-subtle)] text-text-primary text-xs font-bold uppercase tracking-widest px-4 py-3 text-center hover:bg-[color:var(--color-bg-hover)] transition-all"
              href="/login"
              prefetch={false}
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="public-container mt-10 pt-6 sm:px-5 border-t border-[color:var(--color-border-subtle)]/10">
          <span className="text-[10px] font-mono text-text-secondary/50">(c) 2026 Loom. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}
