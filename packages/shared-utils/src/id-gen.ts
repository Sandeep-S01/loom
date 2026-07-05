/**
 * Prefixed ID generation for all entity types.
 * Uses the prefix convention from docs/API.md (e.g., usr_, con_, msg_).
 *
 * Generates URL-safe, unique identifiers using crypto.randomUUID
 * with a type-identifying prefix for readability and debugging.
 */

import { randomUUID } from "crypto";

/** Known entity prefixes matching API.md conventions. */
const PREFIXES = {
  user: "usr",
  device: "dev",
  provider: "prv",
  model: "mdl",
  conversation: "con",
  message: "msg",
  contextSnapshot: "ctx",
  workspace: "wrk",
  agentRun: "run",
  agentRunEvent: "evt",
  fileOperation: "fop",
  commandExecution: "cmd",
  providerAttempt: "att",
  auditEvent: "aud",
  stream: "str",
  request: "req",
  pairingCode: "pair",
} as const;

export type EntityType = keyof typeof PREFIXES;

/**
 * Generate a prefixed unique ID for a given entity type.
 *
 * @param entityType - The type of entity to generate an ID for.
 * @returns A string like "con_a1b2c3d4-e5f6-..."
 */
export function generateId(entityType: EntityType): string {
  const prefix = PREFIXES[entityType];
  const uuid = randomUUID();
  return `${prefix}_${uuid}`;
}

/**
 * Extract the entity type prefix from a generated ID.
 *
 * @param id - A prefixed ID string.
 * @returns The prefix part (e.g., "con" from "con_a1b2c3d4-...")
 */
export function getIdPrefix(id: string): string | null {
  const underscoreIndex = id.indexOf("_");
  if (underscoreIndex === -1) return null;
  return id.substring(0, underscoreIndex);
}
