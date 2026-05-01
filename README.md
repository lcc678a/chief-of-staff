# Chief-of-Staff

**Keep your AI coding project sane.**

Chief-of-Staff is a lightweight MCP server for Cursor that acts as a project chief of staff for AI coding work. It keeps the user and the main AI synchronized, tracks tasks, suggests the next action, audits project state, and helps delegate isolated work to worker agents.

The goal is not to make you manage more AI tools.  
The goal is to let you stay in flow with **one clear chief agent**.

**中文名：** Chief-of-Staff（参谋长）

## What it is

- A **lightweight MCP server for Cursor**
- A **project coordination layer** on top of your repo
- A **local `.chief/` project ledger** (tasks, worker state, handoffs)
- A workflow where the **main AI stays clear** while **workers** handle isolated tasks

## Why

AI coding projects often spin out of control:

- The main chat gets too long
- The model forgets what was already decided or done
- Tasks are half-finished
- Worker agents drift out of scope
- You do not know which Agent window owns which task
- Nobody has a clear next step

Chief-of-Staff keeps a **small project ledger** so the main agent can stay **clear, concise, and useful**.

## Product idea

You interact with **one visible chief**:

- You talk to the chief.
- The chief checks project state.
- The chief suggests the next action.
- The chief prepares worker tasks when needed.
- Workers return summaries.
- You stay focused on product direction instead of managing scattered AI conversations.

The tools exist to support that flow—they are not the product by themselves.

## Who it is for

Chief-of-Staff is for:

- **Vibe coders** who want to build with AI without losing track of what is happening
- **Solo builders** who want one clear project brain instead of scattered chats
- **Professional developers** experimenting with Cursor agents and MCP workflows
- **Teams** that want a lightweight task ledger before introducing heavier project management

## Two recommended modes

### Chief-only mode

Best for:

- New users
- Small projects
- Focused work
- Anyone who wants to stay with **one** main AI

Useful prompts:

- What is the current state?
- What should I do next?
- Is anything inconsistent or broken?

### Chief + workers mode

Best for:

- Larger projects
- Repeated or isolated tasks
- Documentation cleanup
- Local code changes with a clear file scope
- Tasks that do not require the user’s full context

The chief keeps the **main conversation short** and delegates isolated work to **Cursor worker agents**. Workers report back with **summaries**, which saves tokens and reduces confusion.

## Cursor project setup

Chief-of-Staff is configured **per project**. New repos do **not** inherit MCP automatically—**each project needs its own** `.cursor/mcp.json`.

For every project you want Chief-of-Staff to manage, add `.cursor/mcp.json` **in that project’s root**.

- **`args`** point to the **Chief-of-Staff MCP server** entrypoint (`npx` package or local `dist/server.js`).
- **`cwd`** points to the **project being managed** (the repo you opened in Cursor).
- Open the **target project folder** in Cursor.
- Start an **Agent chat inside that project window** (not only from Cursor Home / global entry points).
- **Cursor Home / global Agent** may **not** load project-level MCP servers—if tools are missing, confirm you are in a project-scoped Agent.

Example (published npm package; placeholder path only):

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

The `npx` example assumes the package is **published** and the name matches `chief-mcp-server/package.json`. For **local development** (clone + `npm run build`), see [`chief-mcp-server/README.md`](chief-mcp-server/README.md).

## Current status

- **v0.1 release candidate**
- **Cursor MCP first**; no claim of support for platforms we have not tested
- **Project-level MCP** exercised locally in a Cursor project Agent
- **`chief_doctor`**, **`chief_next_action`**, and **`chief_audit`** verified in that context
- **Cursor SDK** automatic dispatch is **research / design only**—**not shipped** in v0.1
- Capabilities are described conservatively; this is a coordination layer, not a replacement for Cursor

## Core tools

Short list—not a full API reference:

| Tool | Role |
|------|------|
| `chief_doctor` | Check project health |
| `chief_next_action` | Suggest the next step |
| `chief_audit` | Find consistency issues |
| `chief_repair` | Repair missing local state folders / defaults |
| `plan_tasks` | Register tasks |
| `prepare_cursor_agent_task` | Prepare a Cursor worker handoff package |
| `submit_worker_result` | Record worker results |
| `get_worker_board` / `get_worker_status` / `get_worker_summary` | Inspect worker state |
| `chief_config_help`, `chief_external_preflight`, `dispatch_worker` | External API worker route |

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/install-cursor.zh-CN.md](docs/install-cursor.zh-CN.md) | Install in Cursor（中文） |
| [docs/quickstart.zh-CN.md](docs/quickstart.zh-CN.md) | Quick start（中文） |
| [chief-mcp-server/README.md](chief-mcp-server/README.md) | npm package / local dev entry |
| [docs/product-principles.zh-CN.md](docs/product-principles.zh-CN.md) | Product principles（中文） |
| [docs/stage-1-release-notes.zh-CN.md](docs/stage-1-release-notes.zh-CN.md) | Release notes（中文） |
| [docs/product-direction.md](docs/product-direction.md) | Product direction |
| [docs/regression-checklist.md](docs/regression-checklist.md) | Regression checklist |
| [docs/stage-1-acceptance-plan.md](docs/stage-1-acceptance-plan.md) | Acceptance plan |
| [docs/npm-release-checklist.zh-CN.md](docs/npm-release-checklist.zh-CN.md) | npm release checklist（中文） |

## Safety and limitations

- Chief-of-Staff **does not** automatically rename Cursor Agent windows.
- **Manual** Cursor worker handoff (task packages, paste, report back) remains the **stable** path.
- `allowed_files` / `forbidden_files` are **coordination** constraints, **not** a hard OS sandbox.
- **Project-level MCP** must be used in **project context** (open the repo; use a project Agent chat).
- Config tools **do not print** API key values.
- **Cursor SDK dispatch** for workers is **not implemented** in this release.
- **Every new project** needs its own `.cursor/mcp.json` if you want Chief-of-Staff there.

## Why I built this

Coordination beats tool sprawl. Long main chats and unnamed agent windows felt like service without a ticket rail: easy to duplicate work, miss dependencies, or lose the thread. Chief-of-Staff is a small, file-backed ledger so the **chief** stays readable and the **workers** stay scoped—without pretending to replace Cursor or to be a full project-management suite.

## License

MIT. See [LICENSE](LICENSE).
