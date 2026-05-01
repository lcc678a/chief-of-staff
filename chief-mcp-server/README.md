# Chief-of-Staff MCP Server

## What it is

Chief-of-Staff is an MCP server that helps AI coding projects stay sane by tracking tasks, dependencies, worker handoffs, audits, and next actions.

## Current status

- v0.1 candidate
- Cursor MCP supported first
- Claude Code / Lovable / Bolt / other platforms are not claimed as supported yet

## Install in Cursor after npm publish

After this package is published to npm, you can point Cursor at the published binary via `npx` (package name must match `package.json`):

```json
{
  "mcpServers": {
    "chief-of-staff": {
      "command": "npx",
      "args": ["-y", "chief-of-staff-mcp"]
    }
  }
}
```

## Local development setup

```bash
cd chief-mcp-server
npm install
npm run build
```

Example Cursor MCP config using a local `dist` entrypoint (adjust the path to your clone):

```json
{
  "mcpServers": {
    "chief-of-staff": {
      "command": "node",
      "args": ["C:/path/to/chief-of-staff/chief-mcp-server/dist/server.js"]
    }
  }
}
```

## Available tools

- `chief_doctor`
- `chief_repair`
- `chief_audit`
- `chief_next_action`
- `plan_tasks`
- `prepare_cursor_agent_task`
- `submit_worker_result`
- `get_worker_board`
- `get_worker_status`
- `get_worker_summary`
- `chief_config_help`
- `chief_external_preflight`
- `dispatch_worker`

## Safety notes

- Does not display API keys.
- Repair does not overwrite existing task/config files.
- External preflight does not send real API requests.
- Cursor Agent windows cannot be opened or renamed automatically.
