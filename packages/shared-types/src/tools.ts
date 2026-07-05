// Agent tool call/result types derived from docs/AGENTS.md §5

// ─── Tool Names ───────────────────────────────
export type ToolName =
  | "select_workspace"
  | "list_tree"
  | "read_file"
  | "write_file"
  | "patch_file"
  | "delete_path"
  | "move_path"
  | "run_command"
  | "get_run_status";

// ─── Tool Request ─────────────────────────────
export interface ToolRequest {
  type: "tool.request";
  requestId: string;
  runId: string;
  workspaceId: string;
  tool: ToolName;
  payload: Record<string, unknown>;
}

// ─── Tool Result ──────────────────────────────
export type ToolResultStatus = "ok" | "denied" | "error";

export interface ToolResult {
  type: "tool.result";
  requestId: string;
  runId: string;
  status: ToolResultStatus;
  result: Record<string, unknown>;
  stderr?: string;
  durationMs: number;
}

// ─── Specific Tool Payloads ───────────────────

export interface ListTreePayload {
  path?: string;
  maxDepth?: number;
}

export interface ReadFilePayload {
  path: string;
}

export interface WriteFilePayload {
  path: string;
  content: string;
}

export interface PatchFilePayload {
  path: string;
  patches: Array<{
    startLine: number;
    endLine: number;
    replacement: string;
  }>;
}

export interface DeletePathPayload {
  path: string;
}

export interface MovePathPayload {
  fromPath: string;
  toPath: string;
}

export interface RunCommandPayload {
  command: string;
  workingDirectory?: string;
  timeoutMs?: number;
}

// ─── Tool Result Payloads ─────────────────────

export interface ListTreeResult {
  entries: Array<{
    path: string;
    type: "file" | "directory";
    size?: number;
  }>;
}

export interface ReadFileResult {
  content: string;
  encoding: string;
}

export interface WriteFileResult {
  bytesWritten: number;
}

export interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
