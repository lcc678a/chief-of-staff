# Product Direction: Cursor-first Chief-of-Staff

## Product Positioning

Chief-of-Staff is the planning and coordination layer in a Cursor multi-Agent workflow.  
It does not replace Cursor. It helps users run Cursor Agent work in a clearer and more reliable way.

## Core Metaphor

- Cursor is the worker camp.
- Chief-of-Staff is the command staff.

## Problems We Solve

- New users do not know how to split work into executable tasks.
- Users are unsure how many Agent windows they should use.
- Users lack a clear completion loop for done / blocked / failed outcomes.
- Multi-window execution can become confusing without task-line guidance.
- Complex projects need persistent status memory across turns.

## What We Do Not Build

- We do not build a new editor.
- We do not replace Cursor Agent UI.
- We do not build a complex GUI first.
- In the short term, we do not depend on auto-creating Cursor Agent windows.

## Current Mainline

- Cursor-first MVP.
- One-shot project setup via CLI **`npx chief-of-staff-mcp init`**: creates `.cursor/mcp.json` (merge-safe), **`.cursor/rules/chief-of-staff.mdc`** (default Chief/worker workflow, `alwaysApply`), and `.chief/` baseline without overwriting existing user files. **`chief_repair`** still repairs `.chief/` layout only; it does not overwrite an existing rules file (use `init` or restore the rule from the repo when missing).
- External API onboarding via MCP `chief_config_help`: read-only diagnosis of provider config and env-var presence (no key values, no HTTP); complements docs for DashScope / OpenAI-compatible / other providers.
- Before external dispatch, MCP `chief_external_preflight` validates readiness (task/config/deps, same provider/model rules as `dispatch_worker`) without writes or API calls; distinct from `chief_config_help` (config explanation vs dispatch safety).
- `dispatch_worker` mirrors those readiness rules before spawning an external worker: unfinished `depends_on`, missing env key, missing provider/model/config, or `cursor_agent` tasks without explicit provider/model → no dispatch; messages reference `chief_external_preflight` / `chief_config_help`.
- MCP `chief_next_action` compresses queue state into one actionable next step (priority: blocked → failed → waiting → running → pending-deps → ready pending → done); read-only, does not run other tools for the user.
- MCP `chief_audit` reports hidden inconsistencies (duplicate ids, dependency breaks, missing artifacts, file-scope overlaps, orphans); read-only and non-destructive—distinct from `chief_doctor` (light health), `chief_repair` (layout repair), `chief_next_action` (what to do next).
- Cursor-first is not Cursor-only: External API Worker remains a long-term route for user custom models and API-driven automation.
- External API Worker is especially important for user-owned provider/model strategy and scalable background execution.
- Complex workflows should use depends_on/blocked_by and avoid unsafe parallelization of ordered tasks.
- depends_on is not only a record field; it should be used as a safety gate before preparing downstream Cursor worker tasks.
- Cursor window naming remains user-driven: Chief-of-Staff provides suggested names, and users can manually rename Agent windows in Cursor Agents.

## Stage 1 baseline

Stage 1 当前定位：

- **Chief-of-Staff for Cursor**：规划与编排层，不替代 Cursor 本体。
- **Cursor-first but not Cursor-only**：保留 Cursor 工兵与外部 API 工兵两条路线，由用户按执行方式与配置条件选择。
- **Safety-first task orchestration**：依赖门、文件范围、明确 outcome（done / blocked / failed）。
- **Read-only diagnostics before action**：`chief_doctor`、`chief_audit`、`chief_external_preflight`、`chief_config_help`、`chief_next_action` 等以只读诊断与建议为主。
- **Explicit user handoff for Cursor Agents**：任务包复制粘贴到 Agents；窗口命名由用户手动 Rename，不宣称自动打开子窗口或自动 Rename。
- **External API route preserved and diagnosable**：`chief_config_help` / `chief_external_preflight` / `dispatch_worker` 形成配置说明、派发前预检（无真实 HTTP）与派发闭环；预检通过不保证 API 真实可用。
- **Product naming**：对外展示名仍为 Chief-of-Staff；中文展示为 Chief-of-Staff（参谋长）。

**v0.1 packaging：** After Stage 1, the focus shifts to a shippable **Cursor MCP** installable package under `chief-mcp-server` (future `npm publish` / `npx` is planned; not claimed shipped until published). Claude Code / Trae / Workbody adapters are **out of scope** until explicitly built and tested.

Stage 2 候选（与发布说明对齐）：

- automated tests  
- file locks  
- external connectivity test（安全处理密钥）  
- route selection policy  
- task templates  
- Cursor handoff fallback  
- dashboard / UI  
- English docs  

**Research (not shipped):** Cursor has announced a **TypeScript SDK (`@cursor/sdk`)** and **Cloud Agents API v1** for programmatic agents (public beta per Cursor docs). A **literature-only** feasibility note for Chief-of-Staff (e.g. a future `dispatch_cursor_worker`) lives in [docs/cursor-sdk-custom-agents-feasibility.zh-CN.md](cursor-sdk-custom-agents-feasibility.zh-CN.md). **No Cursor SDK integration is claimed** until explicitly built and tested.

## Cursor SDK route

- **Cursor SDK Custom Agents** 已调研；公开资料表明其处于 **public beta**，需要 **`CURSOR_API_KEY`**，且可能产生 **Cursor 用量费用**。
- **未来**可能通过 **`dispatch_cursor_worker`**（及配套 preflight / run 管理工具）实现自动派发 Cursor 工兵；详细设计见 [docs/cursor-sdk-dispatch-worker-design.zh-CN.md](cursor-sdk-dispatch-worker-design.zh-CN.md)。
- **当前尚未集成**：仓库与 MCP 主流程**不包含** `@cursor/sdk` 依赖，也**未实现**上述工具。
- **手动 Cursor worker 路线**（`prepare_cursor_agent_task` + 用户复制到 Agents + `submit_worker_result`）仍是 **Stage 1 及近期的稳定路径**与 **fallback**。

## Product principles

- **Keep the main AI and the user synchronized:** the user should always know what is in flight, what is next, and which task lives in which worker / Agent surface; the chief compresses state into a clear next step.
- **Chief is coordination, not the default app author:** the Chief clarifies vague product intent before implementation, preserves project memory, and **by default** routes implementation through **Cursor Agent Worker** (separate Agent window + task package) or **External API Worker** (user-configured provider/model). The Chief does **not** silently turn the main chat into a bulk code-writing session; small direct edits only when the user explicitly asks.
- **Onboarding order and confirmation semantics matter:** in a new conversation, the Chief should explain role + worker routes first, then ask key decisions, then suggest plans. Short acknowledgements ("ok", "继续", etc.) mean continue talking, not implicit approval to edit files, register tasks, prepare packages, or dispatch workers.
- **Model strategy (common pattern, not a mandate):** users may pair a **stronger reasoning model** in the **Chief** chat with **different** worker models (faster/cheaper/specialized) for implementation. **Cursor** model pickers remain **user-controlled** in each Agent surface; **External API Worker** models come from user **provider/model** configuration. Chief-of-Staff **does not claim** to force or auto-switch Cursor models.
- **One visible chief agent; tools stay behind the workflow:** doctor / audit / next_action / prepare / dispatch are implementation details—the experience is “I ask the chief; the chief tells me what to do next,” not “I manage a pile of tool names.”
- **Short main context; workers for isolated tasks:** split work into tasks, push execution that does not need the user’s ongoing presence to workers, and bring back concise summaries; the chief stays grounded via `.chief/` state and summaries, not endless chat history.
- **Usage modes:** single-chief mode for beginners and small efforts; chief + workers when the project grows and parallelization or context savings matter (see [docs/product-principles.zh-CN.md](product-principles.zh-CN.md)).
- **Known UX issues (not fixed in v0.1 narrative):** task-package display in the Cursor/MCP chain may be compressed or unstable; Agent window naming still relies on the user’s manual Rename—stronger naming conventions are a follow-up.

## Future Directions

- Marketplace
- init
- doctor
- lane
- file locks
- docs
- tests
- Hybrid route: External API Worker for analysis/batch work, Cursor Agent Worker for local code implementation, coordinated by Chief-of-Staff.
