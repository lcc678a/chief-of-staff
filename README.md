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

Before preparing a Cursor worker task package, dependencies in `depends_on` should be done to prevent premature dispatch.
Cursor Agents supports manual Rename: right-click an Agent in the Agents page and rename it using the suggested window name (for example `Cursor 工兵 - workflow`). Chief-of-Staff provides naming hints but does not auto-rename Cursor UI.
