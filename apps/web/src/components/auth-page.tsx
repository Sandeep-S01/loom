"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getOptionalSession, login, register } from "../lib/api";
import { CheckCircle2 } from "lucide-react";

import { Input } from "./ui/input";
import { LoomLogo } from "./loom-logo";

type AuthMode = "login" | "register";

interface AuthPageProps {
  mode: AuthMode;
}

function destinationForRole(role: "admin" | "customer", next: string | null) {
  if (next?.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return role === "admin" ? "/admin" : "/dashboard";
}

function navigateAfterAuth(destination: string) {
  window.location.assign(destination);
}

function formatAuthError(error: unknown, mode: AuthMode) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Could not connect to the server. Please refresh and try again.";
  }

  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return "Could not connect to the server. Please refresh and try again.";
    }

    return error.message;
  }

  return mode === "register"
    ? "We could not create your account right now. Please try again."
    : "We could not sign you in right now. Please try again.";
}

export function AuthPage({ mode }: AuthPageProps) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const copy = useMemo(
    () =>
      mode === "login"
        ? {
            eyebrow: "Welcome back",
            title: "Sign in to Loom",
            description: "Open your workspace to chat with approved models and continue working with connected local context.",
            button: "Sign in",
            alternate: "Need an account?",
            alternateHref: "/register",
            alternateLabel: "Create one",
          }
        : {
            eyebrow: "Get started",
            title: "Create your Loom account",
            description: "Create an account for customer chat powered by backend-controlled providers, approved models, and fallback routing.",
            button: "Start testing Loom",
            alternate: "Already have an account?",
            alternateHref: "/login",
            alternateLabel: "Sign in",
          },
    [mode],
  );

  useEffect(() => {
    let mounted = true;
    getOptionalSession()
      .then((session) => {
        if (!mounted) {
          return;
        }
        if (!session) {
          setIsCheckingSession(false);
          return;
        }
        navigateAfterAuth(destinationForRole(session.user.role, next));
      })
      .catch(() => {
        if (mounted) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [next]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response =
        mode === "login"
          ? await login({ email, password })
          : await register({ email, password, displayName });

      navigateAfterAuth(destinationForRole(response.user.role, next));
    } catch (submitError) {
      setError(formatAuthError(submitError, mode));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[color:var(--color-bg-base)] text-text-primary grid-bg">
      <header className="fixed top-0 z-50 w-full border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-base)]/92 backdrop-blur-sm">
        <nav className="public-container flex items-center justify-between gap-3 py-4 sm:px-5">
          <Link aria-label="Loom home" className="public-focus inline-flex items-center" href="/" prefetch={false}>
            <LoomLogo
              ariaLabel="Loom home"
              className="select-none"
              textClassName="h-6 sm:h-[25px] w-auto"
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-6">
            <Link
              className="public-focus landing-header-link text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary transition-colors hover:text-[color:var(--color-accent-hover)] sm:text-xs sm:tracking-widest"
              href="/"
              prefetch={false}
            >
              Home
            </Link>
            <Link
              className="public-focus landing-header-link landing-primary-cta rounded-md px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition-colors sm:px-4 sm:text-xs sm:tracking-widest"
              href={mode === "login" ? "/register" : "/login"}
              prefetch={false}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </Link>
          </div>
        </nav>
      </header>

      <div className="public-container flex min-h-dvh flex-col pt-24 sm:px-5">
        <section className="grid flex-1 items-start gap-10 py-7 sm:items-center sm:py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="max-w-[620px]">
            <p className="ui-section-label font-mono uppercase tracking-widest text-[color:var(--color-accent)]">Admin-controlled AI workspace</p>
            <h1 className="mt-4 sm:mt-5 font-headline text-[2.1rem] sm:text-4xl md:text-5xl font-normal leading-[1.05] sm:leading-[1.08] tracking-[-0.035em] text-text-primary">
              AI chat with approved models and local workspace context.
            </h1>
            <p className="mt-4 sm:mt-5 max-w-xl text-sm sm:text-base leading-6 sm:leading-7 text-text-secondary">
              Sign in or create an account to test a simple customer workspace while admins keep
              provider credentials, model approval, routing, and fallback on the backend.
            </p>
            <div className="mt-7 space-y-3.5">
              {[
                "Customer chat workspace",
                "Approved model access",
                "Backend-owned provider credentials",
                "Routing, fallback, and availability controls",
              ].map((item) => (
                <div className="flex items-center gap-3 text-[13px] text-text-secondary" key={item}>
                  <CheckCircle2 className="text-[color:var(--color-accent)] h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <form
            className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-panel)] p-5 sm:p-7 overflow-hidden"
            onSubmit={handleSubmit}
          >
            <div className="bg-[color:var(--color-bg-hover)] -mx-5 sm:-mx-7 -mt-5 sm:-mt-7 px-5 py-3 border-b border-[color:var(--color-border-subtle)] flex justify-between items-center mb-6">
              <span className="font-mono text-[9px] uppercase tracking-widest text-text-secondary">Secure account access</span>
              <span className="w-1.5 h-1.5 bg-[color:var(--color-accent)] rounded-full pulse-dot"></span>
            </div>

            <p className="ui-section-label">{copy.eyebrow}</p>
            <h2 className="mt-3 text-2xl font-semibold text-text-primary">
              {copy.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {copy.description}
            </p>

            <fieldset className="mt-6 space-y-5" disabled={isSubmitting || isCheckingSession}>
              {mode === "register" ? (
                <Input
                  autoComplete="name"
                  id="displayName"
                  label="Name"
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  type="text"
                  value={displayName}
                />
              ) : null}

              <Input
                autoComplete="email"
                id="email"
                label="Email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />

              <Input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                id="password"
                label="Password"
                minLength={mode === "register" ? 8 : undefined}
                onChange={(event) => setPassword(event.target.value)}
                required
                revealable
                type="password"
                value={password}
              />
            </fieldset>

            {error ? (
              <div className="mt-4 border border-[color:var(--color-status-error)]/30 bg-[color:var(--color-status-error)]/5 p-4 rounded-md">
                <div className="flex items-center gap-2 text-[color:var(--color-status-error)] text-[10px] font-mono font-bold uppercase tracking-widest mb-1.5">
                  <span className="w-1.5 h-1.5 bg-[color:var(--color-status-error)] rounded-full pulse-dot"></span>
                  {mode === "register" ? "Account error" : "Sign-in error"}
                </div>
                <p className="text-xs text-text-secondary leading-relaxed font-sans">{error}</p>
              </div>
            ) : null}

            <button
              className="public-focus landing-primary-cta mt-7 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:bg-[#ff8d63]"
              disabled={
                isSubmitting ||
                isCheckingSession ||
                !email.trim() ||
                !password.trim() ||
                (mode === "register" && !displayName.trim())
              }
              type="submit"
            >
              {isSubmitting || isCheckingSession ? "Please wait..." : copy.button}
            </button>

            <p className="mt-6 text-center text-sm text-text-secondary">
              {copy.alternate}{" "}
              <Link
                className="public-focus font-semibold text-[color:var(--color-accent-hover)] hover:underline"
                href={copy.alternateHref}
              >
                {copy.alternateLabel}
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
