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
- Cursor-first is not Cursor-only: External API Worker remains a long-term route for user custom models and API-driven automation.
- External API Worker is especially important for user-owned provider/model strategy and scalable background execution.
- Complex workflows should use depends_on/blocked_by and avoid unsafe parallelization of ordered tasks.
- depends_on is not only a record field; it should be used as a safety gate before preparing downstream Cursor worker tasks.
- Cursor window naming remains user-driven: Chief-of-Staff provides suggested names, and users can manually rename Agent windows in Cursor Agents.

## Future Directions

- Marketplace
- init
- doctor
- lane
- file locks
- docs
- tests
- Hybrid route: External API Worker for analysis/batch work, Cursor Agent Worker for local code implementation, coordinated by Chief-of-Staff.
