# Agent System Design

## 1. Purpose

This document defines how agent mode behaves in V1. Agent mode is a desktop-only local-execution workflow that lets an LLM operate on a user-selected project folder through a paired desktop companion.

## 2. Agent Principles

- The agent acts only inside a selected local project root.
- The agent is observable: the user can see progress, file changes, and command outputs.
- The agent is interruptible: the user can stop the run.
- The agent is resumable at the orchestration layer when provider failover occurs.
- The agent is backend-orchestrated but locally executed.

## 3. Agent Architecture

Components:

- `Agent UI`: task input, progress timeline, logs, changed files.
- `Agent Control Service`: run state machine, model prompting, failover coordination.
- `Companion Gateway`: secure bridge from backend to local machine.
- `Desktop Companion Runtime`: file tools, command tools, project selector.

## 4. Agent Capabilities

### Required V1 Capabilities

- Select project root.
- List files and directories under root.
- Read file content.
- Create file.
- Update file.
- Delete file.
- Rename or move file inside root.
- Execute shell command inside root.
- Return diffs or content changes.
- Return command stdout/stderr and exit code.

### Optional Later Capabilities

- Git-aware summaries.
- Destructive action confirmation policy.
- Multi-root workspace support.
- Background long-running tasks.

## 5. Tool Contract

The backend should treat companion actions as structured tool calls. Suggested tool names:

- `select_workspace`
- `list_tree`
- `read_file`
- `write_file`
- `patch_file`
- `delete_path`
- `move_path`
- `run_command`
- `get_run_status`

Each tool call must include:

- `workspace_id`
- `root_path_token`
- `request_id`
- `agent_run_id`
- action-specific payload

Each tool result must include:

- `request_id`
- `status`
- structured result
- `stderr` where relevant
- `duration_ms`

## 6. Workspace Selection

- The browser cannot directly pick the project folder.
- The local desktop companion opens a native folder picker.
- The companion returns canonical path metadata to backend.
- Backend stores a workspace record with machine identity and human-readable alias.
- The agent UI must display the active workspace clearly.

## 7. Workspace Safety Rules

- All paths must be canonicalized.
- Operations must remain inside the approved root after canonicalization.
- Symlink traversal outside the root is denied.
- Commands must execute with working directory set to the root.
- Environment variable exposure should be minimized.
- File operations should use safe path joins and boundary checks.

## 8. Agent Prompting Model

The backend should use a structured prompting envelope for every agent turn:

- user objective
- workspace summary
- recent file changes
- recent command outputs
- current plan state
- tool schema
- safety boundaries

This prevents failover from depending only on raw conversational memory.

## 9. Agent Run Persistence

Store:

- run objective
- current state
- model/provider sequence
- step events
- tool requests/results
- changed file paths
- command history
- final summary

## 10. Agent UX Requirements

- Require workspace selection before enabling task input.
- Show companion connection status.
- Show a simple timeline: `Planning`, `Inspecting`, `Editing`, `Running`, `Switching Model`, `Done`.
- Show changed files in a focused panel.
- Show logs in a collapsible panel.
- Show final summary and stop reason.

## 11. Failure Modes

### Provider Failure

- Persist run checkpoint.
- Summarize current state.
- Switch model if available.
- Resume execution.

### Companion Disconnect

- Move run to `waiting_for_companion`.
- Preserve state.
- Allow resume when connection returns.

### Unsafe Path Attempt

- Deny operation.
- Log audit event.
- Return structured error to backend.

### All Models Exhausted

- Stop run.
- Preserve logs and partial changes.
- Show user-facing capacity message.

## 12. Recommendation

V1 agent mode should prioritize correctness, transparency, and boundary safety over maximum autonomy. The user experience should resemble a simplified coding agent, but every local action must remain attributable and logged.

## 13. Required Agent Skill Set

The product should define a normalized skill profile for any model used in agent mode. These are product-level capabilities, not provider-specific marketing labels.

### Mandatory V1 Skills

- `task_planning`: break a user objective into ordered steps.
- `repository_exploration`: inspect file tree and identify relevant files.
- `code_reading`: understand existing code and config files.
- `targeted_editing`: make precise file updates with minimal unrelated change.
- `file_creation`: add new files when needed.
- `safe_deletion`: remove files only when explicitly justified by task context.
- `command_execution_reasoning`: decide when a command is needed and interpret results.
- `debugging`: use errors, logs, and test output to iterate.
- `context_handoff`: continue effectively after provider/model switching using structured run state.
- `completion_summary`: explain what changed, what failed, and what remains.

### Strongly Recommended V1 Skills

- `diff_awareness`: reason about changed files and avoid duplicate edits.
- `test_awareness`: run relevant tests or checks when present.
- `boundary_awareness`: respect workspace-root and safety constraints.
- `failure_recovery`: adapt after a failed command or failed provider attempt.

### Skills Not Required for V1

- autonomous internet browsing
- multi-repo coordination
- cloud deployment control
- long-horizon autonomous background execution

### Skill-to-UI Mapping

- Planning skill drives the `Planning` timeline state.
- Repository exploration and code reading drive `Inspecting Files`.
- Editing and file creation drive `Editing Files`.
- Command execution reasoning and debugging drive `Running Commands`.
- Context handoff drives `Switching Model`.
- Completion summary drives final run output shown to the user.
