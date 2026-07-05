export type WorkspaceSection =
  | "chat"
  | "workspaces"
  | "models"
  | "companion"
  | "activity"
  | "settings";

export interface WorkspaceSectionMeta {
  label: string;
  eyebrow: string;
  description: string;
  shortLabel: string;
}

export const SECTION_ORDER: WorkspaceSection[] = [
  "chat",
  "workspaces",
  "models",
  "companion",
  "activity",
  "settings",
];

export const SECTION_META: Record<WorkspaceSection, WorkspaceSectionMeta> = {
  chat: {
    label: "Chat",
    eyebrow: "Primary",
    description:
      "Conversations stay in focus while workspace and provider status remain nearby.",
    shortLabel: "CH",
  },
  workspaces: {
    label: "Workspaces",
    eyebrow: "Local Folders",
    description:
      "Manage registered folders and monitor the machine they are bound to.",
    shortLabel: "WS",
  },
  models: {
    label: "Models & API Keys",
    eyebrow: "Providers",
    description:
      "Review model availability and provider routing readiness from one place.",
    shortLabel: "MD",
  },
  companion: {
    label: "Companion",
    eyebrow: "Desktop Pairing",
    description:
      "Pair, reconnect, and troubleshoot the desktop companion without leaving the workspace.",
    shortLabel: "CP",
  },
  activity: {
    label: "Activity",
    eyebrow: "History",
    description:
      "Recent conversations and agent runs stay visible in one consolidated stream.",
    shortLabel: "AC",
  },
  settings: {
    label: "Settings",
    eyebrow: "Configuration",
    description:
      "Organize application preferences by category instead of scattering them across views.",
    shortLabel: "ST",
  },
};
