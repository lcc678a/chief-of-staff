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
- One-shot project repair via MCP `chief_repair`: create missing `.chief` layout and empty `tasks.json` without overwriting user data; rules file is never auto-generated.
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
- **Cursor-first but not Cursor-only**：默认优先 Cursor 工兵，外部 API 工兵路线保留且可诊断。
- **Safety-first task orchestration**：依赖门、文件范围、明确 outcome（done / blocked / failed）。
- **Read-only diagnostics before action**：`chief_doctor`、`chief_audit`、`chief_external_preflight`、`chief_config_help`、`chief_next_action` 等以只读诊断与建议为主。
- **Explicit user handoff for Cursor Agents**：任务包复制粘贴到 Agents；窗口命名由用户手动 Rename，不宣称自动打开子窗口或自动 Rename。
- **External API route preserved and diagnosable**：`chief_config_help` / `chief_external_preflight` / `dispatch_worker` 形成配置说明、派发前预检（无真实 HTTP）与派发闭环；预检通过不保证 API 真实可用。
- **Product naming**：对外展示名仍为 Chief-of-Staff；中文展示为 Chief-of-Staff（参谋长）。

Stage 2 候选（与发布说明对齐）：

- automated tests  
- file locks  
- external connectivity test（安全处理密钥）  
- route selection policy  
- task templates  
- Cursor handoff fallback  
- dashboard / UI  
- English docs  

## Future Directions

- Marketplace
- init
- doctor
- lane
- file locks
- docs
- tests
- Hybrid route: External API Worker for analysis/batch work, Cursor Agent Worker for local code implementation, coordinated by Chief-of-Staff.
