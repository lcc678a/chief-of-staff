# Cursor-first Workflow

## Roles

- Main window: Chief-of-Staff (planning and coordination).
- Worker windows: Cursor Agent Worker (execution).

## Standard Flow

1. User states the requirement.
2. Chief registers tasks.
3. Chief prepares a worker task package.
4. User copies the task package.
5. User pastes it into a Cursor Agent worker window.
6. Worker executes and calls `submit_worker_result`.
7. Chief summarizes result as done / blocked / failed.

## Multi-window Strategy

- Reuse the same window for the same lane.
- Use different windows for different lanes.
- Do not modify the same file scope in parallel tasks.

## Outcome Protocol

- `done`: task completed with usable result.
- `blocked`: task cannot proceed and needs input or decision.
- `failed`: execution failed with error details.

## UX Principles

- Low interruption.
- Final handoff stays as one sentence plus one code block.
- Do not force users to read long explanations.
- Keep required execution context inside the task package.
