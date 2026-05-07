# Chief-of-Staff MCP Server

npm package for the **Chief-of-Staff** MCP server: a governance layer for Cursor agents—the **Chief** keeps task state consistent, guarded, and auditable while workers implement.

**Product overview:** see the repository root [README.md](../README.md).

## Recommended setup

```bash
cd your-project
npx chief-of-staff-mcp init
```

- Run **`init` once per project** from that project’s **root** (`process.cwd()` is the managed project).
- It creates **`.cursor/mcp.json`**, **`.cursor/rules/chief-of-staff.mdc`**, and **`.chief/`** (when missing; existing files are not overwritten).
- **Reload or restart Cursor**, then confirm **`chief-of-staff` is enabled** in Cursor MCP settings. Some Cursor versions require **manually enabling** a newly added MCP server; if tools do not appear, open MCP settings and turn it on.
- **Open** the project in Cursor, then start an **Agent chat inside that project window**. **Cursor Home / global Agent** may **not** load project-level MCP.

CLI:

```text
chief-of-staff-mcp              # start MCP server (default)
chief-of-staff-mcp init         # initialize current project
chief-of-staff-mcp --help       # help
```

For local development of this repo, use `node dist/server.js` with the same subcommands.

## What the rule does

The generated **`.cursor/rules/chief-of-staff.mdc`** (`alwaysApply: true`) makes **new project Agent chats** follow the Chief-of-Staff workflow:

- In a new project conversation, the Chief first explains the working mode and worker routes before proposing product plans.
- The **Chief governs execution flow**—clarifies vague product goals before coding, tracks state, applies safety gates, and suggests next steps.
- **Implementation normally** goes through **Cursor Agent Worker** handoffs. External API Worker remains an advanced route.
- The Chief should explain the practical effect of both routes and ask which route the user wants when implementation is ready.
- The user can switch route/direction later; the Chief should update plans before preparing or dispatching work.
- Short acknowledgements such as **"ok" / "yes" / "好" / "继续"** are continuation signals, not approval to edit files, register tasks, prepare packages, or dispatch workers.
- The Chief **should not** directly create or edit application code **by default**; only small direct edits when the **user explicitly** asks, after stating which files will change.

**Installing MCP without this rule** leaves Cursor behaving like a **normal assistant**; use **`init`** (or copy the rule yourself) to get Chief behavior.

## Model strategy: stronger Chief, flexible Workers

This package **does not automatically select Cursor models** for you.

A **common pattern** is to use a **stronger reasoning model** in the **main Chief** chat (direction, memory, decisions, decomposition, handoff, review) and **other models** for workers—e.g. **faster / cheaper** or **specialized** models for implementation.

- **Cursor Agent Worker:** the user chooses the model in the **separate Cursor Agent worker** window.
- **External API Worker:** the user configures **provider / model / API** in Chief-of-Staff external worker settings.

Chief-of-Staff **organizes the workflow**; it does **not** pretend to control every model choice inside Cursor.

## Worker routes

### Cursor Agent Worker

- The Chief prepares a **task package** (`prepare_cursor_agent_task`).
- You open a **separate Cursor Agent window**.
- You **paste** the task package into that worker.
- The worker implements; **you bring the worker summary back to the Chief**, and the Chief records the outcome when useful (`submit_worker_result`). Results do **not** return automatically from the worker window.

### External API Worker

- You configure **your own** provider / model / API (environment variables; see `chief_config_help`). The provider key in `.chief/config.json` is **free-form** (`openai`, `dashscope`, `deepseek`, `moonshot`, ...); anything that exposes an OpenAI-compatible `/chat/completions` endpoint with `Authorization: Bearer <key>` works.
- This is an **advanced route**, not the default onboarding path for most Cursor-first users.
- The Chief runs **`chief_external_preflight`** before dispatch.
- The Chief calls **`dispatch_worker`** only when configuration and route fit.
- The worker is a **detached background process**. `dispatch_worker` returns immediately; the Chief should **not** block the user waiting on it.
- Outcomes are written to the task ledger plus a persisted result file: `.chief/results/<task>.md` (full output) and `.chief/logs/<task>.log` (streaming log). The task gets `summary`, `result_file`, `log_file`, and final `status`.
- Default Chief reporting back to the user is **paths-first**: status + one-line summary + `result_file` path + `log_file` path. The Chief opens the full result/log only when the user explicitly asks.
- **No API key values** are printed by tools.

## Advanced / manual MCP setup

You may edit **`.cursor/mcp.json`** by hand. You should still add **`.cursor/rules/chief-of-staff.mdc`** (or equivalent), or the Agent may **not** follow Chief/worker boundaries—**MCP alone is not enough**.

### Install from npm (published package)

Confirm the package exists on the registry. Example:

```json
{
  "mcpServers": {
    "chief-of-staff": {
      "command": "npx",
      "args": ["-y", "chief-of-staff-mcp"],
      "cwd": "C:/Users/<you>/path/to/your-project"
    }
  }
}
```

### Local development

```bash
cd chief-mcp-server
npm install
npm run build
```

```json
{
  "mcpServers": {
    "chief-of-staff": {
      "command": "node",
      "args": ["C:/Users/<you>/path/to/chief-of-staff/chief-mcp-server/dist/server.js"],
      "cwd": "C:/Users/<you>/path/to/your-managed-project"
    }
  }
}
```

After MCP changes, **restart Cursor** and use a **project-scoped** Agent chat.

## What you get

- MCP tools for health, repair, audits, task planning, worker handoffs, and read-only next-step guidance
- A governance workflow built around **one Chief conversation** and **worker-side implementation**
- **No** claim that Cursor Home / global Agents load project-level MCP

## Cursor behavior

- Open the **target folder** in Cursor; use an **Agent** scoped to that workspace.
- **Home / global** Agents **may not** expose project MCP—this is Cursor behavior, not necessarily a failed install.

## Status and scope

- **v0.1.5** — source/package alignment and generated-rule encoding cleanup after v0.1.4.
- **v0.1.4** — cleanup hotfix: package-lock metadata sync, dispatch-start logs, worker stdout/stderr appended to task logs, and root README alignment after v0.1.3.
- **v0.1.3** — critical hotfix for the **External API Worker** route. Fixes the `dispatch_worker` worker-script path (resolved relative to the installed package, not the user project), removes the hardcoded `dashscope` provider name (any OpenAI-compatible provider key works), serializes streaming log writes, persists the full worker output to `.chief/results/<task>.md`, and documents the route as **async + paths-first** (Chief does not block the user, does not auto-read full results into the main chat).
- **v0.1.2** — CLI **`init`** plus default **Chief/worker** Cursor rule; docs clarify manual Cursor Agent Worker handoff and MCP first-enable behavior
- **Cursor MCP** is the primary integration
- **Cursor SDK** auto-dispatch is **not** shipped; design/research only
- **No** untested-platform support claims

## Core tools (short)

| Area | Tools |
|------|--------|
| Health / repair | `chief_doctor`, `chief_repair` |
| Deeper checks | `chief_audit` |
| Next step | `chief_next_action` |
| Tasks / workers | `plan_tasks`, `prepare_cursor_agent_task`, `submit_worker_result`, `get_worker_board`, `get_worker_status`, `get_worker_summary` |
| External API route | `chief_config_help`, `chief_external_preflight`, `dispatch_worker` |

## Safety notes

- Config tools **never print** API key values.
- `chief_repair` does **not** overwrite existing task or config files.
- `chief_external_preflight` does **not** send real HTTP requests.
- Chief-of-Staff does **not** open or rename Cursor Agent windows automatically.
- File scopes are **agreements**, not a hard sandbox.

## License

MIT. See [LICENSE](../LICENSE) in the repository root.
