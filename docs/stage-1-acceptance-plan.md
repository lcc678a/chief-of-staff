# Stage 1 Acceptance Plan

## Goal

Validate whether the Chief-of-Staff Cursor-first MVP can support baseline orchestration for complex projects:

- Task decomposition
- Dispatching Cursor workers
- Collecting `done` / `blocked` / `failed`
- Multi-window lane management
- File scope constraints
- Dependency safety gate
- External API route preservation
- `chief_doctor` / `get_worker_board` status visibility

## Test setup

- Restart Cursor.
- Open the project root directory.
- Create one main chief window.
- Select `A Cursor 工兵` as the default route.
- If external route is tested, configure `.chief/config.json` and matching API key environment variables.
- Do not commit `.chief/tasks.json` during test execution.

## Smoke tests

1. Run `chief_doctor` with empty tasks and verify baseline health output.
2. Create one Cursor worker task and verify one-sentence handoff plus one ```text code block: Cursor UI must render a copyable code box, not plain text only; the task package first line must appear **inside** the fence.
3. Paste task package into a new Cursor Agent and verify first-line labels and Rename guidance.
4. Submit `submit_worker_result` with `outcome=done`.
5. Submit `submit_worker_result` with `outcome=blocked`.
6. Submit `submit_worker_result` with `outcome=failed`.
7. Run `get_worker_board` and verify lane display.
8. Trigger out-of-scope operation under `allowed_files` and verify blocked feedback.
9. Set `depends_on` to unfinished task and verify dispatch is blocked.
10. Verify external worker `provider` / `model` are preserved and not overwritten.

## Expected results

1. `chief_doctor` returns no critical error on empty-task baseline.
2. Handoff format stays constrained to one sentence + one ```text code block; the chat must show a rendered Markdown code block / copy affordance, not bare task-package text with the first line outside any fence.
3. Task header includes `lane` / `task_id` / `window_hint`, and package includes manual Rename hint.
4. `outcome=done` moves task status to `done`.
5. `outcome=blocked` moves task status to `blocked` and preserves actionable `needs`.
6. `outcome=failed` moves task status to `failed` and preserves `error`.
7. Worker board groups and displays tasks by lane with clear worker type labeling.
8. File-scope violation is rejected as `blocked`, and scope details are visible in status views.
9. Unfinished dependencies stop dispatch; only `depends_on` with status `done` can pass.
10. External route keeps user-selected provider/model, and no API key leaks in doctor or summaries.

## Known limitations

- Cursor Agent windows cannot be auto-renamed by the system.
- Local Cursor child windows cannot be auto-opened by the system.
- Task package copy/paste remains the current handoff UI.
- No hard file lock is enforced.
- Dependency safety gate currently focuses on Cursor worker dispatch protection.
- External API route depends on user-provided key configuration.
- Automated regression test suite is not yet established.

## Regression rule

- Keep one commit per feature task.
- Run stage regression every 3-5 feature tasks.
- Execute this full plan before final release.
