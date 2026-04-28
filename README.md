## Cursor-first workflow

Chief-of-Staff works as a planning layer for Cursor Agent workflows.
The main chat acts as the chief.
Cursor Agent windows act as workers.
Tasks are passed via copyable task packages.
Workers report back with `done` / `blocked` / `failed`.
This keeps multi-agent execution structured without replacing Cursor itself.

## Two Worker Routes

Chief-of-Staff is Cursor-first for MVP, but not Cursor-only.

- Cursor Agent Worker: local interactive code edits in Cursor windows.
- External API Worker: user-provided API model/provider for automation, batch, long-running, or text-only tasks.
- External API Worker is the preferred route when users explicitly request custom model/provider or backend execution.

Hybrid usage is supported: External API Worker can handle research/batch analysis first, then Cursor Agent Worker applies local code changes.

Complex workflows can use `depends_on` / `blocked_by` to avoid unsafe parallel execution. Dependencies complement lane and file scopes.
