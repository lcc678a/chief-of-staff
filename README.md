<!-- TODO: replace with a real GIF/screenshot. Suggested path: docs/images/demo.gif -->
<!-- <p align="center"><img src="docs/images/demo.gif" width="720" alt="Chief-of-Staff demo" /></p> -->

<h1 align="center">Chief-of-Staff</h1>
<p align="center"><b>Stop your AI coding agent from losing the plot.</b></p>
<p align="center"><i>An MCP server for Cursor that keeps one clear chief agent in charge — so your project stays sane.</i></p>

---

## The problem you already know

You're 30 messages deep with Cursor.

- The AI just rewrote a file it shouldn't have touched.
- It forgot what you decided an hour ago.
- Half the tasks are "kind of done."
- You opened three Agent windows and now you don't remember which one owns what.
- Nobody — including you — has a clear next step.

That's not a you problem. That's what happens when a long chat becomes a project.

## What Chief-of-Staff does

Chief-of-Staff runs **alongside Cursor** as a quiet "chief of staff" for your project.

You keep talking to **one** Chief agent in your main chat. In the background, Chief-of-Staff:

- Keeps a small **project ledger** (`.chief/`) of what's decided, what's in progress, what's next.
- Asks **clarifying questions** before the AI starts coding, so vague goals don't turn into rewrites.
- Suggests **one clear next action** when you don't know what to do.
- **Audits** for inconsistencies — half-finished tasks, drifted scope, broken dependencies.
- Routes implementation to **workers** (a separate Cursor Agent window, or your own external API) instead of letting the main chat silently become a solo programmer.

You stay in flow. The AI stays clear. The project stays a project, not a 4-hour conversation.

## Install in 30 seconds

From the root of any project you want to manage:

```bash
cd your-project
npx chief-of-staff-mcp init
```

That's it.

This adds:

- `.cursor/mcp.json` — registers the Chief-of-Staff MCP server
- `.cursor/rules/chief-of-staff.mdc` — makes new Agent chats default to Chief behavior
- `.chief/` — the local project ledger (tasks, worker state, handoffs)

Then **restart Cursor**, make sure `chief-of-staff` is **enabled** in Cursor's MCP settings, and open an **Agent chat inside the project window**. Your next chat is a Chief chat.

> Run `init` **once per project**. New projects don't inherit MCP automatically — each project gets its own setup. Re-running is safe; existing files aren't overwritten.

## Why I built this

> I'm not a professional engineer. I'm a chef.
>
> I tried building things with AI like everyone else. Every project crashed the same way: the AI got tired, forgot, drifted, "fixed" things that weren't broken, and I lost the thread. It felt like running a kitchen with no tickets — easy to duplicate work, miss a dish, lose the night.
>
> So I built Chief-of-Staff. First for myself. Now for anyone whose AI keeps going off the rails.

That's the entire pitch. It's a coordination layer, not a smarter model.

## Who it's for

- **Vibe coders** building real things with AI without wanting to babysit it
- **Solo builders** who want one clear project brain instead of scattered chats
- **Developers** experimenting with Cursor Agents and MCP workflows
- **Small teams** who want a lightweight task ledger before reaching for heavier PM tools

## How the workflow actually feels

You interact with **one visible Chief** in your main Agent chat:

- The Chief **clarifies** vague goals (platform, MVP, data, milestones, worker route) **before** any code gets written.
- The Chief checks project state and suggests **one clear next action**.
- The Chief **tracks** agreed work in `.chief/` when it's worth tracking.
- In a new chat, the Chief first explains how this works (Chief role, worker routes) before proposing plans.
- **By default the Chief does not edit application code.** Implementation goes to:
  - **Cursor Agent Worker** — the Chief gives you a copyable task package; you paste it into a separate Cursor Agent window; the worker implements; you bring the summary back to the Chief.
  - **External API Worker** — you configure your own provider / model / API keys; the Chief uses preflight then dispatch when the route fits.
- Short replies like **"ok" / "yes" / "继续"** are **not** approval to edit files, register tasks, or dispatch workers. The Chief asks before doing.
- Simple work is **one** worker task. Complex work splits into a few tasks with scopes and dependencies — not a multi-agent zoo.
- The Chief **only** makes a small direct edit in the main chat when **you explicitly ask**.

## Stronger Chief, flexible Workers

A common pattern (not a requirement):

- Use a **stronger reasoning model** for the **main Chief** chat — it carries direction, memory, decisions, decomposition.
- Use **faster / cheaper / specialized** models for **workers** that just execute.

Chief-of-Staff doesn't pick or auto-switch models for you:

- **Chief (Cursor):** you pick the model in your main Cursor Agent chat.
- **Cursor Agent Worker:** you pick the model in the worker window.
- **External API Worker:** you configure provider / model / API in Chief-of-Staff's external worker settings.

That separation lets you put high-quality thinking in the Chief and route execution to workers that fit cost and latency — without pretending to control every model choice inside Cursor.

## Core tools

A short list — not a full API reference:

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

## Troubleshooting: Chief tools don't appear

- Make sure you opened the **target project folder** in Cursor.
- **Reload / restart** Cursor after `init` or MCP config changes.
- Open Cursor's **MCP settings** and **enable** `chief-of-staff` if it's disabled (some Cursor versions require manually enabling a newly added server).
- Use an **Agent chat inside the project window**, not Cursor Home / global Agent.

## Status

- **v0.1.2** — one-step per-project setup via `npx chief-of-staff-mcp init` (MCP config + default rule + `.chief/` baseline)
- **Cursor MCP first.** No claim of support for platforms not yet tested.
- **Project-level MCP** exercised locally inside a Cursor project Agent.
- `chief_doctor`, `chief_next_action`, and `chief_audit` verified in that context.
- **Cursor SDK** automatic dispatch is **research / design only** — not shipped in v0.1.
- This is a coordination layer, not a replacement for Cursor.

## Safety and limitations

- Chief-of-Staff **does not** automatically rename or open Cursor Agent windows.
- **Manual** Cursor worker handoff (task packages, paste, report back) is the **stable** path.
- `allowed_files` / `forbidden_files` are **coordination** constraints, **not** an OS sandbox.
- **Project-level MCP** must be used in **project context** (open the repo; use a project Agent chat).
- Config tools **never print** API key values.
- **Cursor SDK dispatch** for workers is **not implemented** in this release.
- **Every new project** needs its own setup: run `npx chief-of-staff-mcp init` from that project root, or maintain `.cursor/mcp.json` manually.

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

## License

MIT. See [LICENSE](LICENSE).

---

**中文名：** Chief-of-Staff（参谋长）

If Chief-of-Staff saved you from one chaotic AI coding session, a ⭐ on GitHub means a lot. It's how a chef-built tool finds the next person who needs it.
