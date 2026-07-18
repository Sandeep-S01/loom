import type { SecretReader } from "./interfaces.js";

export function createEnvSecretReader(env: NodeJS.ProcessEnv = process.env): SecretReader {
  return {
    async hasSecret(secretRef) {
      const value = env[secretRef];
      return typeof value === "string" && value.trim().length > 0;
    },
  };
}
