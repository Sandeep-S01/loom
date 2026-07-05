/**
 * Path safety utilities for workspace boundary enforcement.
 * Derived from docs/SECURITY.md §4.4 and docs/AGENTS.md §7.
 *
 * Rules:
 * - All paths must be canonicalized.
 * - Operations must remain inside the approved root after canonicalization.
 * - Symlink traversal outside the root is denied.
 * - Commands must execute with working directory set to the root.
 * - File operations should use safe path joins and boundary checks.
 */

import { normalize, resolve, relative, sep } from "path";

/**
 * Resolves and canonicalizes a requested path against a workspace root.
 * Returns the absolute resolved path, or null if the path escapes the root.
 *
 * @param workspaceRoot - The absolute canonical path to the workspace root.
 * @param requestedPath - The relative or absolute path to validate.
 * @returns The resolved absolute path if safe, or null if it escapes the root.
 */
export function resolveWithinRoot(
  workspaceRoot: string,
  requestedPath: string,
): string | null {
  // Normalize the root to remove trailing slashes and resolve . / ..
  const normalizedRoot = normalize(workspaceRoot);

  // Resolve the requested path against the root
  const resolved = resolve(normalizedRoot, requestedPath);

  // Check that the resolved path starts with the root
  if (!isInsideRoot(normalizedRoot, resolved)) {
    return null;
  }

  return resolved;
}

/**
 * Checks whether a resolved absolute path is inside the workspace root.
 *
 * @param root - The absolute canonical workspace root path.
 * @param target - The absolute resolved target path to check.
 * @returns true if target is equal to or inside root.
 */
export function isInsideRoot(root: string, target: string): boolean {
  const normalizedRoot = normalize(root);
  const normalizedTarget = normalize(target);

  // Exact match (the root itself)
  if (normalizedTarget === normalizedRoot) {
    return true;
  }

  // Must be under root + separator to prevent prefix matching
  // e.g., /workspace-extra should not match /workspace
  const rootPrefix = normalizedRoot.endsWith(sep)
    ? normalizedRoot
    : normalizedRoot + sep;

  return normalizedTarget.startsWith(rootPrefix);
}

/**
 * Gets the relative path from root to target, or null if target is outside root.
 *
 * @param root - The absolute canonical workspace root path.
 * @param target - The absolute resolved target path.
 * @returns The relative path if inside root, or null if outside.
 */
export function getRelativePath(root: string, target: string): string | null {
  if (!isInsideRoot(root, target)) {
    return null;
  }

  const rel = relative(normalize(root), normalize(target));

  // Double-check: relative path should not start with ".."
  if (rel.startsWith("..")) {
    return null;
  }

  return rel;
}

/**
 * Checks whether a path string contains suspicious traversal patterns.
 * This is a pre-check before resolution — not a substitute for proper
 * canonicalization and boundary checking.
 *
 * @param pathStr - The raw path string to check.
 * @returns true if the path contains suspicious patterns.
 */
export function containsTraversalPatterns(pathStr: string): boolean {
  const normalized = pathStr.replace(/\\/g, "/");
  return (
    normalized.includes("../") ||
    normalized.includes("/..") ||
    normalized === ".." ||
    normalized.startsWith("../")
  );
}
