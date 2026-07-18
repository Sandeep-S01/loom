import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentFilePath = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(currentFilePath), "..", "..");
const repoRoot = path.resolve(backendRoot, "..", "..");

export function getBackendEnvFilePaths() {
  return [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
    path.join(backendRoot, ".env.local"),
    path.join(backendRoot, ".env"),
  ];
}

export function loadBackendEnv() {
  for (const envPath of getBackendEnvFilePaths()) {
    if (!existsSync(envPath)) {
      continue;
    }

    dotenv.config({
      path: envPath,
      override: false,
    });
  }
}
