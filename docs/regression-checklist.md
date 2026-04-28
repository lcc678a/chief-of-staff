# Regression Checklist: Core Worker Tools

## Cursor worker handoff

Check:

- `prepare_cursor_agent_task` returns `USER_VISIBLE_CURSOR_AGENT_HANDOFF_START` / `USER_VISIBLE_CURSOR_AGENT_HANDOFF_END`.
- `USER_VISIBLE` contains only one prompt sentence plus one ```text code block.
- `COPY_THIS` marker still exists for backward compatibility.
- Task package includes `task_id` / `suggested_model` / `lane` / `window_hint`.
- Task package includes `submit_worker_result` examples for `done` / `blocked` / `failed`.

## Worker outcomes

Check:

- `submit_worker_result` defaults `outcome` to `done` when omitted.
- `outcome=done` -> status `done`.
- `outcome=blocked` -> status `blocked` and includes `needs`.
- `outcome=failed` -> status `failed` and includes `error`.

## Lane/window

Check:

- `plan_tasks` accepts optional `lane`.
- `prepare_cursor_agent_task` defaults `lane=general` when missing.
- `window_hint` defaults to `Cursor 工兵 - {lane}`.
- `status` / `summary` display `lane` and `window_hint`.

## Manual end-to-end smoke test

Minimal steps:

1. Restart Cursor.
2. Use the chief agent to register and prepare one simple task.
3. Verify final reply is one sentence plus one code block.
4. Paste the task package into a new worker agent window.
5. Submit `done`.
6. Check summary from the chief agent.
7. Test `blocked`.
8. Test `failed`.
9. Test re-sending `waiting_for_cursor_agent` task package.
