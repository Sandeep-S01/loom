const SIDEBAR_EXPANDED_STORAGE_KEY = "clm.workspace.sidebar_expanded";

interface StorageLike {
  getItem: (key: string) => string | null;
}

export function getInitialSidebarExpandedState() {
  return true;
}

export function readStoredSidebarExpandedState(
  storage: StorageLike,
) {
  const saved = storage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY);
  return saved ? saved === "true" : true;
}

export { SIDEBAR_EXPANDED_STORAGE_KEY };
