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
11. Run `chief_repair` with `dry_run: true`, then optionally without dry run on a scratch copy: verify sections 已修复/预演、正常、需要人工处理; no API key text; existing `tasks.json` not overwritten.
12. Run `chief_config_help` (with and without `provider`): summary sections present; no secret values; states that no live API call is made.
13. Run `chief_external_preflight` with/without `task_id`: read-only; no HTTP; no key values; `depends_on` not `done` → 暂不建议派发; output distinguishes preflight from `chief_config_help`.
14. With external route: `dispatch_worker` rejects unfinished `depends_on`, rejects `cursor_agent` tasks unless `provider` or `model` is passed, and surfaces config/key errors with hints to `chief_external_preflight` / `chief_config_help` (no secrets).
15. Run `chief_next_action`: output is Chinese Markdown with one primary recommendation; read-only; references queue priority order.
16. Run `chief_audit`: Markdown sections for 总览 / 阻断问题 / 警告 / 信息; read-only; does not modify tasks or delete orphans.

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
11. `chief_repair` only fills missing paths; preserves valid existing `tasks.json` / `config.json`; surfaces invalid `tasks.json` without overwriting; default config creation does not leak keys; missing rules file yields a manual-restore message only.
12. `chief_config_help` remains read-only, prints no env values, and does not imply API reachability—only config shape and env presence.
13. `chief_external_preflight` is read-only, never calls remote APIs, never prints secrets, and flags dependency/config blockers before `dispatch_worker`.
14. `dispatch_worker` enforces dependency completion and basic external readiness before spawning a worker; does not leak API keys.
15. `chief_next_action` stays read-only and does not imply that other tools ran automatically.
16. `chief_audit` remains read-only and reports structural issues without auto-fix.

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
