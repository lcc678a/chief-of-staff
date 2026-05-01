# Chief-of-Staff MCP Server

npm package for the **Chief-of-Staff** MCP server: a lightweight coordination layer for Cursor that keeps a local `.chief/` ledger, suggests next actions, audits state, and supports worker handoffs.

**Product overview and positioning:** see the repository root [README.md](../README.md).

## What you get

- MCP tools for health checks, repair, audits, task planning, Cursor worker packages, external API workers, and read-only “what next” guidance
- A workflow built around **one chief conversation** and **short, scoped worker runs**
- **No** claim that Cursor Home / global Agents load project-level MCP—you configure and use this **inside the target project window**

## Install from npm (when published)

Confirm the package name exists on the registry (`package.json` → `name`). Then point Cursor at `npx`:

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

- **`args`** reference the **Chief-of-Staff server** (here, the published package via `npx`).
- **`cwd`** must be the **root of the project you are managing** (the repo open in Cursor).
- MCP is **per project**: copy or create `.cursor/mcp.json` in **each** repo that should use Chief-of-Staff.

If the package is **not** published yet, use **local development** below—do not rely on `npx` until the name is live on npm.

## Local development

```bash
cd chief-mcp-server
npm install
npm run build
```

Point Cursor at the built server with `node` and an absolute path to `dist/server.js`. Set **`cwd`** to the **managed project root** (often your clone of this repo or another repo you opened in Cursor):

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

You can start from the repo’s `.cursor/mcp.json.example` at the workspace root (copy to `.cursor/mcp.json` and replace placeholders). **Do not commit** personal absolute paths.

After changing MCP config, **restart Cursor** and open an **Agent chat inside the project** you configured.

## Cursor behavior

- Open the **target folder** in Cursor and use an **Agent** scoped to that workspace.
- Agents started from **Cursor Home / global** context **may not** expose project-level MCP tools—this is a Cursor behavior, not necessarily a failed install.

## Status and scope

- **v0.1 release candidate**
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
