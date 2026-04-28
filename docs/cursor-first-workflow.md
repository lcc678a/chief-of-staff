# Cursor-first Workflow

## Roles

- Main window: Chief-of-Staff (planning and coordination).
- Worker windows: Cursor Agent Worker (execution).
- External API Worker is also supported for API-key based custom models and automation tasks.
- When user intent is "my API/custom model/backend run", prefer External API Worker instead of Cursor worker windows.

## Project layout

- If `.chief/` or `tasks.json` is missing, the chief can run MCP `chief_repair` (`dry_run: true` first, optional) to create directories, an empty `tasks.json`, default `config.json` when absent, and `agent-tasks` / `results` folders. Existing `tasks.json` and `config.json` are never overwritten; invalid `tasks.json` must be fixed manually. Missing `chief-of-staff.mdc` is reported but not auto-generated.
- For external API worker settings, MCP `chief_config_help` summarizes providers, models, `base_url`, and whether each `api_key_env` is set (never values); it does not call remote APIs. Cursor Agent Worker remains available without any API key.

## Standard Flow

1. User states the requirement.
2. Chief registers tasks.
3. Chief prepares a worker task package.
4. User copies the task package.
5. User pastes it into a Cursor Agent worker window.
6. Worker executes and calls `submit_worker_result`.
7. Chief summarizes result as done / blocked / failed.

## Multi-window Strategy

- Reuse the same window for the same lane.
- Use different windows for different lanes.
- Do not modify the same file scope in parallel tasks.
- Use depends_on/blocked_by for ordered tasks; do not parallelize tasks with clear prerequisite order.
- Prepare Cursor worker tasks only after depends_on tasks are done; if dependencies are unclear, run research/spec first.

## Outcome Protocol

- `done`: task completed with usable result.
- `blocked`: task cannot proceed and needs input or decision.
- `failed`: execution failed with error details.

## UX Principles

- Low interruption.
- Final handoff stays as one sentence plus one code block.
- Do not force users to read long explanations.
- Keep required execution context inside the task package.

## Route Note

Cursor-first is the current MVP mainline, not Cursor-only.

- Use Cursor Agent Worker for local interactive coding tasks.
- Use External API Worker for custom provider/model usage, long or batch tasks, and text-only analysis.
- Mixed route is recommended when needed: external worker for upstream analysis, Cursor worker for local code changes.
- Dependencies complement lane and file scopes in complex project workflows.
- For multi-window discoverability, use task-package first-line tag + suggested window name + worker board together; users can manually rename in Cursor Agents via right-click Agent → Rename.
