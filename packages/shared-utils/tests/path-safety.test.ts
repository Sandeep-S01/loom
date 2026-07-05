import { describe, it, expect } from "vitest";
import { resolve, sep } from "path";
import {
  resolveWithinRoot,
  isInsideRoot,
  getRelativePath,
  containsTraversalPatterns,
} from "../src/path-safety.js";

// Use platform-appropriate test paths
const isWindows = sep === "\\";
const root = isWindows ? "C:\\projects\\my-app" : "/projects/my-app";

describe("resolveWithinRoot", () => {
  it("allows a relative path inside root", () => {
    const result = resolveWithinRoot(root, "src/index.ts");
    expect(result).toBe(resolve(root, "src/index.ts"));
  });

  it("allows nested paths inside root", () => {
    const result = resolveWithinRoot(root, "src/utils/helpers.ts");
    expect(result).toBe(resolve(root, "src/utils/helpers.ts"));
  });

  it("allows the root itself", () => {
    const result = resolveWithinRoot(root, ".");
    expect(result).toBe(resolve(root));
  });

  it("rejects traversal above root", () => {
    const result = resolveWithinRoot(root, "../other-project/file.ts");
    expect(result).toBeNull();
  });

  it("rejects deeply nested traversal above root", () => {
    const result = resolveWithinRoot(root, "src/../../other/file.ts");
    expect(result).toBeNull();
  });

  it("rejects absolute paths outside root", () => {
    const outsidePath = isWindows ? "C:\\other\\file.ts" : "/other/file.ts";
    const result = resolveWithinRoot(root, outsidePath);
    expect(result).toBeNull();
  });
});

describe("isInsideRoot", () => {
  it("returns true for paths under root", () => {
    const target = resolve(root, "src/file.ts");
    expect(isInsideRoot(root, target)).toBe(true);
  });

  it("returns true for the root itself", () => {
    expect(isInsideRoot(root, root)).toBe(true);
  });

  it("returns false for paths outside root", () => {
    const outside = isWindows
      ? "C:\\projects\\other-app\\file.ts"
      : "/projects/other-app/file.ts";
    expect(isInsideRoot(root, outside)).toBe(false);
  });

  it("returns false for prefix-match attacks", () => {
    // /projects/my-app-extra should NOT match /projects/my-app
    const prefixAttack = isWindows
      ? "C:\\projects\\my-app-extra\\file.ts"
      : "/projects/my-app-extra/file.ts";
    expect(isInsideRoot(root, prefixAttack)).toBe(false);
  });
});

describe("getRelativePath", () => {
  it("returns relative path for paths inside root", () => {
    const target = resolve(root, "src/file.ts");
    const rel = getRelativePath(root, target);
    expect(rel).toBe(["src", "file.ts"].join(sep));
  });

  it("returns empty string for root itself", () => {
    expect(getRelativePath(root, root)).toBe("");
  });

  it("returns null for paths outside root", () => {
    const outside = isWindows
      ? "C:\\other\\file.ts"
      : "/other/file.ts";
    expect(getRelativePath(root, outside)).toBeNull();
  });
});

describe("containsTraversalPatterns", () => {
  it("detects ../", () => {
    expect(containsTraversalPatterns("../etc/passwd")).toBe(true);
  });

  it("detects /.. in middle", () => {
    expect(containsTraversalPatterns("src/../../../etc")).toBe(true);
  });

  it("detects standalone ..", () => {
    expect(containsTraversalPatterns("..")).toBe(true);
  });

  it("allows normal paths", () => {
    expect(containsTraversalPatterns("src/index.ts")).toBe(false);
  });

  it("allows paths with dots in names", () => {
    expect(containsTraversalPatterns("src/.env.local")).toBe(false);
  });
});
