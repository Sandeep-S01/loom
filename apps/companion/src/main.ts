import { invoke } from "@tauri-apps/api/core";
import type { PairCompleteResponse, WorkspaceListItem } from "@clm/shared-types";
import { completePairing, selectWorkspace } from "./api";

interface FolderSelection {
  path: string;
  alias: string;
}

interface CompanionStatus {
  version: string;
  connected: boolean;
}

interface MachineIdentity {
  machineLabel: string;
  fingerprintSeed: string;
}

interface PersistedSession {
  deviceId: string;
  machineSessionToken: string;
  machineLabel: string;
  machineFingerprintHash: string;
}

interface PersistedWorkspace extends WorkspaceListItem {
  canonicalPathHash: string;
}

interface ViewState {
  version: string;
  pairingCode: string;
  pairingError: string | null;
  workspaceError: string | null;
  isPairing: boolean;
  isSelectingWorkspace: boolean;
  session: PersistedSession | null;
  workspace: PersistedWorkspace | null;
}

const SESSION_STORAGE_KEY = "clm.companion.session";
const WORKSPACE_STORAGE_KEY = "clm.companion.workspace";

const statusBadgeEl = document.getElementById("status-badge") as HTMLDivElement;
const connectionStateEl = document.getElementById("connection-state") as HTMLParagraphElement;
const connectionInfoEl = document.getElementById("connection-info") as HTMLParagraphElement;
const connectionDetailEl = document.getElementById("connection-detail") as HTMLParagraphElement;
const pairingInputEl = document.getElementById("pairing-input") as HTMLInputElement;
const pairButtonEl = document.getElementById("pair-btn") as HTMLButtonElement;
const pairingErrorEl = document.getElementById("pairing-error") as HTMLParagraphElement;
const selectFolderBtn = document.getElementById("select-folder-btn") as HTMLButtonElement;
const workspacePathEl = document.getElementById("workspace-path") as HTMLParagraphElement;
const workspaceMetaEl = document.getElementById("workspace-meta") as HTMLParagraphElement;
const workspaceErrorEl = document.getElementById("workspace-error") as HTMLParagraphElement;
const versionLabel = document.getElementById("version-label") as HTMLSpanElement;

const state: ViewState = {
  version: "0.1.0",
  pairingCode: "",
  pairingError: null,
  workspaceError: null,
  isPairing: false,
  isSelectingWorkspace: false,
  session: loadJson<PersistedSession>(SESSION_STORAGE_KEY),
  workspace: loadJson<PersistedWorkspace>(WORKSPACE_STORAGE_KEY),
};

pairingInputEl.addEventListener("input", () => {
  state.pairingCode = pairingInputEl.value;
  if (state.pairingError) {
    state.pairingError = null;
    render();
  }
});

pairButtonEl.addEventListener("click", async () => {
  const pairingCode = state.pairingCode.trim();
  if (!pairingCode) {
    state.pairingError = "Pairing code is required.";
    render();
    return;
  }

  state.isPairing = true;
  state.pairingError = null;
  render();

  try {
    const identity = await invoke<MachineIdentity>("get_machine_identity");
    const machineFingerprintHash = await sha256(`machine:${identity.fingerprintSeed}`);
    const response = await completePairing({
      pairingCode,
      machineLabel: identity.machineLabel,
      machineFingerprintHash,
    });

    state.session = {
      ...toPersistedSession(identity.machineLabel, machineFingerprintHash, response),
    };
    state.workspace = null;
    state.pairingCode = "";
    state.workspaceError = null;

    saveJson(SESSION_STORAGE_KEY, state.session);
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch (error) {
    state.pairingError =
      error instanceof Error ? error.message : "Failed to complete pairing.";
  } finally {
    state.isPairing = false;
    render();
  }
});

selectFolderBtn.addEventListener("click", async () => {
  if (!state.session) {
    state.workspaceError = "Pair the companion before selecting a workspace.";
    render();
    return;
  }

  state.isSelectingWorkspace = true;
  state.workspaceError = null;
  render();

  try {
    const result = await invoke<FolderSelection | null>("select_folder");
    if (!result) {
      return;
    }

    const canonicalPathHash = await sha256(normalizePathForHash(result.path));
    const response = await selectWorkspace({
      machineId: state.session.deviceId,
      alias: result.alias,
      canonicalPathHash,
      displayPathHint: result.path,
    });

    state.workspace = {
      ...response.workspace,
      canonicalPathHash,
    };
    saveJson(WORKSPACE_STORAGE_KEY, state.workspace);
  } catch (error) {
    state.workspaceError =
      error instanceof Error ? error.message : "Failed to register workspace.";
  } finally {
    state.isSelectingWorkspace = false;
    render();
  }
});

void init();

async function init() {
  try {
    const status = await invoke<CompanionStatus>("get_companion_status");
    state.version = status.version;
  } catch (error) {
    console.error("Failed to get companion status:", error);
  }

  render();
}

function render() {
  versionLabel.textContent = `v${state.version}`;
  pairingInputEl.value = state.pairingCode;
  pairButtonEl.disabled = state.isPairing || Boolean(state.session);
  selectFolderBtn.disabled = state.isSelectingWorkspace || !state.session;

  const currentState = getCurrentStateLabel();
  connectionStateEl.textContent = currentState;
  connectionInfoEl.textContent = getConnectionSummary();
  connectionDetailEl.textContent = state.session
    ? `Machine ${state.session.machineLabel} paired as ${state.session.deviceId}`
    : "Enter a pairing code from the web app to connect this desktop companion.";

  statusBadgeEl.textContent = state.session ? "Connected" : "Disconnected";
  statusBadgeEl.classList.toggle("badge--connected", Boolean(state.session));
  statusBadgeEl.classList.toggle("badge--disconnected", !state.session);

  workspacePathEl.textContent = state.workspace?.displayPathHint ?? "No folder selected";
  workspaceMetaEl.textContent = state.workspace
    ? `${state.workspace.alias} · ${state.workspace.status}`
    : "Select a project folder after pairing to register a workspace.";

  pairingErrorEl.textContent = state.pairingError ?? "";
  pairingErrorEl.hidden = !state.pairingError;
  workspaceErrorEl.textContent = state.workspaceError ?? "";
  workspaceErrorEl.hidden = !state.workspaceError;

  pairButtonEl.textContent = state.isPairing
    ? "Pairing..."
    : state.session
      ? "Paired"
      : "Pair Companion";
  selectFolderBtn.textContent = state.isSelectingWorkspace
    ? "Registering Workspace..."
    : "Select Project Folder";
}

function getCurrentStateLabel() {
  if (state.pairingError) {
    return "Pairing failed";
  }

  if (!state.session) {
    return state.isPairing ? "Entering pairing code" : "Unpaired";
  }

  return state.workspace ? "Paired with workspace selected" : "Paired but no workspace selected";
}

function getConnectionSummary() {
  if (state.pairingError) {
    return state.pairingError;
  }

  if (!state.session) {
    return state.isPairing
      ? "Completing pairing with the backend..."
      : "Not paired with backend yet.";
  }

  return state.workspace
    ? "Companion is paired and the current workspace is registered."
    : "Companion is paired. Select a project folder to register a workspace.";
}

function toPersistedSession(
  machineLabel: string,
  machineFingerprintHash: string,
  response: PairCompleteResponse,
): PersistedSession {
  return {
    deviceId: response.deviceId,
    machineSessionToken: response.machineSessionToken,
    machineLabel,
    machineFingerprintHash,
  };
}

function normalizePathForHash(path: string) {
  return path.replace(/\\/g, "/").toLowerCase();
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return `sha256:${hashArray.map((item) => item.toString(16).padStart(2, "0")).join("")}`;
}

function loadJson<T>(key: string): T | null {
  const rawValue = localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function saveJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}
