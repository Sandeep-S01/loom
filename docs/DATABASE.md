# Database Design

## 1. Storage Overview

Recommended primary database: PostgreSQL.

Recommended supporting store: Redis for ephemeral state.

PostgreSQL is used for durable application history and auditability. Redis is used for connection maps, cooldown counters, transient locks, and live orchestration state.

## 2. Entity Model

## 2.1 users

Purpose:

- Store the single V1 user profile and settings.

Suggested columns:

- `id`
- `email`
- `display_name`
- `password_hash`
- `created_at`
- `updated_at`
- `last_login_at`

## 2.2 devices

Purpose:

- Track known browser or desktop machine identities.

Suggested columns:

- `id`
- `user_id`
- `device_type` (`browser`, `desktop_companion`)
- `machine_label`
- `machine_fingerprint_hash`
- `last_seen_at`
- `created_at`

## 2.3 providers

Purpose:

- Normalized provider registry.

Suggested columns:

- `id`
- `name`
- `base_type`
- `status`
- `priority_rank`
- `created_at`
- `updated_at`

## 2.4 models

Purpose:

- Model catalog under providers.

Suggested columns:

- `id`
- `provider_id`
- `name`
- `external_model_key`
- `supports_chat`
- `supports_agent`
- `supports_vision`
- `context_window`
- `priority_rank`
- `active`
- `created_at`
- `updated_at`

Indexes:

- `(provider_id, active)`
- `(supports_agent, active, priority_rank)`

## 2.5 conversations

Purpose:

- User-facing threads.

Suggested columns:

- `id`
- `user_id`
- `mode` (`chat`, `agent`)
- `title`
- `archived`
- `last_message_at`
- `created_at`
- `updated_at`

Indexes:

- `(user_id, updated_at desc)`
- `(user_id, archived, updated_at desc)`

## 2.6 messages

Purpose:

- Transcript entries for conversations.

Suggested columns:

- `id`
- `conversation_id`
- `role` (`system`, `user`, `assistant`, `tool`, `status`)
- `content_json`
- `provider_id`
- `model_id`
- `token_estimate_in`
- `token_estimate_out`
- `sequence_no`
- `created_at`

Indexes:

- `(conversation_id, sequence_no)`

## 2.7 context_snapshots

Purpose:

- Compact continuity payloads for model switching.

Suggested columns:

- `id`
- `conversation_id`
- `agent_run_id` nullable
- `summary_text`
- `summary_json`
- `source_message_id`
- `created_at`

## 2.8 workspaces

Purpose:

- Local project-folder bindings.

Suggested columns:

- `id`
- `user_id`
- `device_id`
- `alias`
- `canonical_path_hash`
- `display_path_hint`
- `status` (`active`, `missing`, `disconnected`)
- `last_used_at`
- `created_at`
- `updated_at`

Indexes:

- `(user_id, last_used_at desc)`

## 2.9 agent_runs

Purpose:

- Execution records for agent tasks.

Suggested columns:

- `id`
- `conversation_id`
- `workspace_id`
- `objective`
- `status`
- `started_at`
- `ended_at`
- `final_summary`
- `stop_reason`
- `created_at`
- `updated_at`

Indexes:

- `(workspace_id, created_at desc)`
- `(status, created_at desc)`

## 2.10 agent_run_events

Purpose:

- Timeline and audit-friendly event log for a run.

Suggested columns:

- `id`
- `agent_run_id`
- `event_type`
- `payload_json`
- `sequence_no`
- `created_at`

Indexes:

- `(agent_run_id, sequence_no)`

## 2.11 file_operations

Purpose:

- Structured record of file mutations or reads performed during runs.

Suggested columns:

- `id`
- `agent_run_id`
- `operation_type` (`read`, `create`, `update`, `delete`, `move`)
- `relative_path`
- `target_relative_path` nullable
- `status`
- `metadata_json`
- `created_at`

Indexes:

- `(agent_run_id, created_at)`

## 2.12 command_executions

Purpose:

- Structured record of commands run during agent execution.

Suggested columns:

- `id`
- `agent_run_id`
- `command_text`
- `working_directory_relative`
- `exit_code`
- `stdout_excerpt`
- `stderr_excerpt`
- `duration_ms`
- `created_at`

## 2.13 provider_attempts

Purpose:

- Track every provider/model invocation attempt.

Suggested columns:

- `id`
- `conversation_id` nullable
- `agent_run_id` nullable
- `provider_id`
- `model_id`
- `attempt_no`
- `status` (`success`, `failed`, `switched`)
- `failure_code` nullable
- `latency_ms`
- `started_at`
- `ended_at`

Indexes:

- `(provider_id, started_at desc)`
- `(agent_run_id, started_at)`
- `(conversation_id, started_at)`

## 2.14 audit_events

Purpose:

- Security and product audit trail.

Suggested columns:

- `id`
- `user_id`
- `device_id` nullable
- `event_type`
- `subject_type`
- `subject_id`
- `payload_json`
- `created_at`

Indexes:

- `(user_id, created_at desc)`
- `(event_type, created_at desc)`

## 3. Redis Keys

Suggested ephemeral keys:

- `provider:cooldown:{modelId}`
- `provider:failcount:{modelId}`
- `companion:connection:{deviceId}`
- `run:lock:{runId}`
- `stream:state:{streamId}`

## 4. Data Retention

- Conversations and messages: retain indefinitely in V1.
- Agent run events: retain indefinitely in V1 unless storage pressure requires archiving.
- Command stdout/stderr: store excerpts in primary tables and raw logs separately if needed.
- Audit events: retain indefinitely.

## 5. Migration Notes

- Keep all tables user-scoped even though V1 has one user.
- Avoid storing raw absolute local paths where not needed; prefer hashes plus display hints.
- Keep provider/model configuration seedable via admin bootstrap scripts.
