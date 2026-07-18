const REQUIRED_URLS = [
  { name: "DATABASE_URL", protocols: ["postgres:", "postgresql:"] },
  { name: "REDIS_URL", protocols: ["redis:", "rediss:"] },
] as const;

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return;

  const errors: string[] = [];
  for (const requirement of REQUIRED_URLS) {
    const value = env[requirement.name];
    if (!value) {
      errors.push(`${requirement.name} is required`);
      continue;
    }
    try {
      const url = new URL(value);
      if (!(requirement.protocols as readonly string[]).includes(url.protocol)) {
        errors.push(`${requirement.name} uses an unsupported protocol`);
      }
    } catch {
      errors.push(`${requirement.name} must be a valid URL`);
    }
  }

  const frontendOrigins = [env.FRONTEND_URL, env.FRONTEND_URLS]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  if (frontendOrigins.length === 0) {
    errors.push("FRONTEND_URL or FRONTEND_URLS is required");
  }
  for (const origin of frontendOrigins) {
    try {
      const url = new URL(origin);
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (url.protocol !== "https:" && !local) {
        errors.push(`Frontend origin must use HTTPS: ${origin}`);
      }
    } catch {
      errors.push(`Frontend origin must be a valid URL: ${origin}`);
    }
  }

  if (env.ALLOW_DEV_SESSION === "true") {
    errors.push("ALLOW_DEV_SESSION must not be enabled in production");
  }
  if (env.METRICS_ENABLED === "true" && (!env.METRICS_TOKEN || env.METRICS_TOKEN.length < 32)) {
    errors.push("METRICS_TOKEN must contain at least 32 characters when metrics are enabled");
  }
  if (errors.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
  }
}
