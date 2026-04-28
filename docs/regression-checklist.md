# Regression Checklist: Core Worker Tools

## chief_repair / project layout

Check:

- `chief_repair` accepts optional `dry_run`; `true` performs no writes, `false`/omit applies fixes.
- Creates missing `.chief/`, `.chief/agent-tasks/`, `.chief/results/` as needed.
- Creates `.chief/tasks.json` with `[]` only when missing; never overwrites an existing file; invalid JSON or non-array is reported for manual fix.
- Missing `.chief/config.json` uses `ensureDefaultConfigFile` behavior (default template, no secrets in output); never overwrites existing config.
- Does not emit API keys; does not auto-generate `.cursor/rules/chief-of-staff.mdc` (report only).

## chief_config_help / external API config

Check:

- `chief_config_help` accepts optional `provider`; read-only; no writes to `.chief/config.json`; no HTTP.
- Reports `default_provider`, provider list, each `base_url` / `api_key_env` / model slots; env presence as 已配置 or 未配置 only (never values).
- Missing or invalid config handled with Chinese guidance (missing file → `chief_repair` hint; invalid JSON → manual fix).
- Unknown `provider` argument yields short “not found” message.

## chief_next_action

Check:

- Optional `lane` / `limit` (default 5, max 10); read-only; never writes tasks or dispatches workers.
- Covers missing/invalid tasks.json, empty queue, then priority blocked → failed → waiting_for_cursor_agent → running → pending unmet deps → ready pending → all done.
- Suggests tools (`plan_tasks`, `prepare_cursor_agent_task`, `chief_external_preflight`, `chief_repair`, etc.) without invoking them.

## chief_external_preflight

Check:

- Optional `task_id` / `provider` / `model`; read-only; no task/config writes; no HTTP.
- Provider/model resolution matches `dispatch_worker`; reports config/key/base_url/model/deps issues in Chinese.
- Env key status only 已配置 / 未配置 / 未检查; never prints values.
- `depends_on` must all be `done`; otherwise lists blocking tasks.
- Distinguishable from `chief_config_help` (dispatch readiness vs config explanation).

## dispatch_worker (external API)

Check:

- `depends_on` not all `done` → no `running` update, Chinese message listing incomplete deps + `chief_external_preflight` hint.
- `worker_route === "cursor_agent"` without explicit `provider`/`model` in tool args → no dispatch; Chinese guidance.
- Config read / missing provider / missing model / unset `api_key_env` / unset env → failure + short `chief_external_preflight` / `chief_config_help` hint; env **name** only, never values.
- Provider/model resolution unchanged: `input` → `task` → `default_provider` / `models[model_level]`.

## Cursor worker handoff

Check:

- `prepare_cursor_agent_task` returns `USER_VISIBLE_CURSOR_AGENT_HANDOFF_START` / `USER_VISIBLE_CURSOR_AGENT_HANDOFF_END`.
- `USER_VISIBLE` contains only one prompt sentence plus one ```text code block.
- Final user-visible reply must include a **complete** ```text fenced code block (opening ```text and closing ```).
- **No** bare task package outside a fence (failure if the package first line appears as normal paragraph text).
- At most one prompt line before the fence; **no** text after the closing fence.
- `COPY_THIS` marker still exists for backward compatibility.
- Task package includes `task_id` / `suggested_model` / `lane` / `window_hint`.
- Task package includes `submit_worker_result` examples for `done` / `blocked` / `failed`.

## Worker outcomes

Check:

- `submit_worker_result` defaults `outcome` to `done` when omitted.
- `outcome=done` -> status `done`.
- `outcome=blocked` -> status `blocked` and includes `needs`.
- `outcome=failed` -> status `failed` and includes `error`.

## Lane/window

Check:

- `plan_tasks` accepts optional `lane`.
- `prepare_cursor_agent_task` defaults `lane=general` when missing.
- `window_hint` defaults to `Cursor 工兵 - {lane}`.
- `status` / `summary` display `lane` and `window_hint`.

## Lane and worker board

Check:

- `plan_tasks` can persist `lane` / `window_hint`.
- `prepare_cursor_agent_task` defaults `lane=general` when missing.
- Task package first line includes `lane` / `task_id` / `window_hint`.
- `get_worker_board` shows tasks grouped by `lane`.
- Worker board reminds users that Cursor Agents can be manually renamed.
- External workers are not mislabeled as Cursor windows.

## File scopes

Check:

- `allowed_files` / `forbidden_files` can be written into a task.
- Task package displays file scope constraints inside the package body.
- Worker replies `blocked` when asked to operate outside allowed scope.
- `status` shows concrete file scope details.
- `summary` shows file scope counts.

## Dependencies

Check:

- `depends_on` / `blocked_by` can be written into a task.
- `status` shows concrete dependency details.
- `summary` shows dependency counts.
- Worker board shows dependency statistics.
- `prepare_cursor_agent_task` blocks dispatch when `depends_on` is unfinished.
- Dispatch is allowed only when dependency status is `done`.

## External API route

Check:

- User-defined `provider` / `model` are not overridden.
- `chief_doctor` does not leak API keys.
- External workers display `provider` / `model` in `status` / `summary` / `board`.
- Rules clearly state Cursor-first does not mean Cursor-only.

## Manual rename

Check:

- Task package includes the right-click Agent -> Rename reminder.
- Worker board reminds users that manual Rename is available.
- Docs explicitly state the system cannot auto-rename agent windows.

## Manual end-to-end smoke test

Minimal steps:

1. Restart Cursor.
2. Use the chief agent to register and prepare one simple task.
3. Verify final reply is one sentence plus one code block.
4. Paste the task package into a new worker agent window.
5. Submit `done`.
6. Check summary from the chief agent.
7. Test `blocked`.
8. Test `failed`.
9. Test re-sending `waiting_for_cursor_agent` task package.
