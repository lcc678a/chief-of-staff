# Chief-of-Staff

**Product name:** Chief-of-Staff  
**中文名：** Chief-of-Staff（参谋长）  
**Positioning:** Chief-of-Staff for Cursor  
**Scope:** Cursor-first but not Cursor-only（以 Cursor 为主战场，同时保留外部 API 工兵路线）。

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/quickstart.zh-CN.md](docs/quickstart.zh-CN.md) | 中文快速开始 |
| [docs/stage-1-release-notes.zh-CN.md](docs/stage-1-release-notes.zh-CN.md) | Stage 1 中文发布说明 |
| [docs/stage-1-acceptance-plan.md](docs/stage-1-acceptance-plan.md) | Stage 1 验收计划 |
| [docs/regression-checklist.md](docs/regression-checklist.md) | 回归清单 |
| [docs/product-direction.md](docs/product-direction.md) | 产品方向 |

## Cursor-first workflow

Chief-of-Staff works as a planning layer for Cursor Agent workflows.
The main chat acts as the chief.
Cursor Agent windows act as workers.
Tasks are passed via copyable task packages.
Workers report back with `done` / `blocked` / `failed`.
This keeps multi-agent execution structured without replacing Cursor itself.

## Two Worker Routes

Chief-of-Staff is Cursor-first for MVP, but not Cursor-only.

- Cursor Agent Worker: local interactive code edits in Cursor windows.
- External API Worker: user-provided API model/provider for automation, batch, long-running, or text-only tasks.
- External API Worker is the preferred route when users explicitly request custom model/provider or backend execution.

Hybrid usage is supported: External API Worker can handle research/batch analysis first, then Cursor Agent Worker applies local code changes.

Complex workflows can use `depends_on` / `blocked_by` to avoid unsafe parallel execution. Dependencies complement lane and file scopes.

## Project layout repair

The MCP tool `chief_repair` creates missing `.chief/` directories, an empty `.chief/tasks.json` when absent, `.chief/agent-tasks/` and `.chief/results/`, and a default `.chief/config.json` when missing (no API keys written). It does not overwrite existing task or config files. Use `dry_run: true` to preview actions. If `.cursor/rules/chief-of-staff.mdc` is missing, restore it from the repo; the tool does not generate it.

The MCP tool `chief_config_help` (read-only) explains external API worker setup: `default_provider`, each provider's `base_url`, `api_key_env`, whether the env var is set (never the value), and `cheap` / `smart` / `genius` models. No network calls. Cursor Agent Worker does not need an external API key.

The MCP tool `chief_external_preflight` (read-only) checks whether `dispatch_worker` can run for optional `task_id`: resolved provider/model (same precedence as dispatch), env key presence, `depends_on` completion, and route hints. No writes, no network, no secret values. Use it before external dispatch; use `chief_config_help` to understand config files.

`dispatch_worker` applies the same gates: it does not start an external worker if `depends_on` is incomplete, if the API key env is unset, if config/model/provider is missing, or if `worker_route` is `cursor_agent` without an explicit `provider` or `model`. Failure messages point to `chief_external_preflight` and `chief_config_help` (no secret values printed).

The MCP tool `chief_next_action` (read-only) summarizes what to do next from `.chief/tasks.json`: blocked → failed → waiting_for_cursor_agent → running → pending with unfinished deps → ready pending → all done; optional `lane` filter and `limit`. It suggests tools such as `plan_tasks`, `prepare_cursor_agent_task`, `chief_external_preflight`, `chief_repair`, but does not execute them.

The MCP tool `chief_audit` (read-only) performs a deeper consistency audit: duplicate task ids, broken `depends_on`/`blocked_by`, invalid status/model_level, missing task-package or result files, blocked/failed metadata gaps, external tasks without provider/model, simple `allowed_files` overlaps among active tasks, and optional orphan files under `.chief/agent-tasks/` / `.chief/results/` (baseline `chief_doctor` stays lightweight). It never writes files or fixes data.

Before preparing a Cursor worker task package, dependencies in `depends_on` should be done to prevent premature dispatch.
Cursor Agents supports manual Rename: right-click an Agent in the Agents page and rename it using the suggested window name (for example `Cursor 工兵 - workflow`). Chief-of-Staff provides naming hints but does not auto-rename Cursor UI.
