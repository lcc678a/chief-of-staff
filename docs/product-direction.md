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
- Cursor-first is not Cursor-only: External API Worker remains a long-term route for user custom models and API-driven automation.

## Future Directions

- Marketplace
- init
- doctor
- lane
- file locks
- docs
- tests
- Hybrid route: External API Worker for analysis/batch work, Cursor Agent Worker for local code implementation, coordinated by Chief-of-Staff.
