import { describe, expect, it } from "vitest";
import {
  getInitialSidebarExpandedState,
  readStoredSidebarExpandedState,
} from "./workspace-sidebar-preferences";

describe("workspace-sidebar-preferences", () => {
  it("uses a deterministic expanded default for the initial render", () => {
    expect(getInitialSidebarExpandedState()).toBe(true);
  });

  it("reads a stored collapsed preference only from browser storage after mount", () => {
    const storage = new Map<string, string>([
      ["clm.workspace.sidebar_expanded", "false"],
    ]);

    const value = readStoredSidebarExpandedState({
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
    });

    expect(value).toBe(false);
  });
});
