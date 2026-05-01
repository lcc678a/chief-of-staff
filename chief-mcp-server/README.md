# Chief-of-Staff MCP Server

npm package for the **Chief-of-Staff** MCP server: a lightweight coordination layer for Cursor that keeps a local `.chief/` ledger, suggests next actions, audits state, and supports worker handoffs.

**Product overview and positioning:** see the repository root [README.md](../README.md).

## Recommended: `init` (per project)

Run **from the root of the project** you want Chief-of-Staff to manage (the repo you will open in Cursor):

```bash
cd your-project
npx chief-of-staff-mcp init
```

- **`init` must be run from the project root** (`process.cwd()` becomes the managed project).
- **Each project** should run **`init` once** (safe to re-run: existing files are skipped, `mcp.json` is merged if needed).
- Creates `.cursor/mcp.json`, `.cursor/rules/chief-of-staff.mdc` (`alwaysApply: true`), and `.chief/` baseline (`tasks.json`, `agent-tasks/`, `results/`, default `config.json`—no API keys).
- After `init`, **restart or reload Cursor**, then use an **Agent chat inside that project window**. **Cursor Home / global Agent** may **not** load project-level MCP.

CLI entrypoints:

```text
chief-of-staff-mcp              # start MCP server (default)
chief-of-staff-mcp init         # initialize current project
chief-of-staff-mcp --help       # help
```

For **local development** of the server itself, use `node dist/server.js` with the same subcommands.

## Advanced / manual MCP setup

If you prefer not to use `init`, add `.cursor/mcp.json` yourself. **`args`** must point at the Chief-of-Staff server entrypoint; **`cwd`** must be the **managed project root**.

### Install from npm (published package)

Confirm the package name exists on the registry (`package.json` → `name`). Example:

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

MCP is **per project**: each repo needs its own configuration.

If the package is **not** published yet, use **local development** below—do not rely on `npx` until the name is live on npm.

### Local development

```bash
cd chief-mcp-server
npm install
npm run build
```

Point Cursor at the built server with `node` and an absolute path to `dist/server.js`. Set **`cwd`** to the **managed project root**:

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

You can start from the monorepo’s `.cursor/mcp.json.example` (copy to `.cursor/mcp.json` and replace placeholders). **Do not commit** personal absolute paths.

After changing MCP config, **restart Cursor** and open an **Agent chat inside the project** you configured.

## What you get

- MCP tools for health checks, repair, audits, task planning, Cursor worker packages, external API workers, and read-only “what next” guidance
- A workflow built around **one chief conversation** and **short, scoped worker runs**
- **No** claim that Cursor Home / global Agents load project-level MCP—you configure and use this **inside the target project window**

## Cursor behavior

- Open the **target folder** in Cursor and use an **Agent** scoped to that workspace.
- Agents started from **Cursor Home / global** context **may not** expose project-level MCP tools—this is a Cursor behavior, not necessarily a failed install.

## Status and scope

- **v0.1.1** — includes CLI **`init`** for project setup
- **Cursor MCP** is the primary, tested integration
- **Cursor SDK**-based automatic worker dispatch is **not** shipped; design/research only (see repo docs)
- **No** support claims for editors or agents we have not tested

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
