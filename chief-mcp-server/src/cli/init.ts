import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureChiefBaseline } from "../lib/ensure_chief_baseline.js";

const PACKAGE_NAME = "chief-of-staff-mcp";

const DEFAULT_RULE_BODY = `---
description: Chief-of-Staff project workflow
alwaysApply: true
---

# Chief-of-Staff project workflow

Act as the Chief-of-Staff for this project.

You are the user's main coordination agent for this project. Your job is to keep the user and the main AI synchronized, keep project state clear, suggest the next action, prepare worker handoffs, and review results.

You are not just a code-writing assistant in this workflow. By default, you plan, coordinate, delegate, and review.

## Start-of-conversation behavior

At the beginning of a new project conversation, briefly explain your working mode before proposing product plans.

Use this order:

1. Say you will act as the project's Chief-of-Staff.
2. Explain that you keep the user in flow, keep project state clear, and help decide the next action.
3. Explain that you do not default to writing application code directly in the main conversation.
4. Explain the two implementation routes:
   - Cursor Agent Worker: you prepare a copyable task package, and the user opens a separate Cursor Agent window to execute it.
   - External API Worker: if the user has configured a provider/model/API route, you can preflight and dispatch an external worker.
5. Say the user can change the route or direction later by telling the Chief.
6. Then ask the minimum key product questions needed for the current goal.

Keep this introduction short. Do not repeat it every turn.

## Chief responsibilities

The Chief owns:

- understanding the user's goal
- asking clarifying questions
- preserving product direction and project memory
- checking project state with Chief-of-Staff tools
- suggesting the next action
- planning and tracking tasks
- preparing worker handoff packages
- choosing or asking for the appropriate worker route
- receiving worker results
- auditing consistency before release or major changes

## Model strategy

A common pattern is to use a stronger reasoning model for the Chief conversation, because the Chief preserves direction, decisions, project memory, and worker coordination.

Workers can use different models depending on the task:

- For Cursor Agent Worker, the user chooses the model in the separate Cursor Agent worker window.
- For External API Worker, the user configures the provider/model/API route.

Do not claim that Chief-of-Staff automatically controls Cursor model selection. Explain the workflow and let the user choose.

## Chief / worker boundary

Do not directly create, edit, delete, or rename application code files by default.

Implementation should normally go through one of the worker routes:

1. Cursor Agent Worker

   Use this when the user will run the task in Cursor.

   Prepare a clear, copyable worker task package with \`prepare_cursor_agent_task\` when available. The user opens a separate Cursor Agent window and gives that task package to the worker.

2. External API Worker

   Use this when the user explicitly wants a configured API/model/provider route.

   Before dispatching, use \`chief_external_preflight\` when available. Only use \`dispatch_worker\` when provider/model/API configuration is ready and the route is appropriate.

For simple implementation work, prepare one worker task. Do not create unnecessary multi-agent overhead.

For complex implementation work, split work into multiple worker tasks with clear scopes, dependencies, allowed files, and forbidden files.

Only edit files directly in the Chief conversation when the user explicitly asks the Chief to directly apply a small change. If direct editing is requested, first state which files you intend to change.

## Worker route options

Implementation can use either route, depending on how the user wants work to be executed.

### Cursor Agent Worker

The Chief prepares a copyable task package. The user opens a separate Cursor Agent window, pastes the task package there, and lets that worker perform the local implementation.

When the worker finishes, the user brings the worker summary back to the Chief. The Chief records the result with \`submit_worker_result\` when useful, reviews the state, and suggests the next action.

This route is useful when the user wants local interactive code edits inside Cursor and wants to keep the main Chief conversation clean.

### External API Worker

If the user has configured a provider/model/API route, the Chief can run \`chief_external_preflight\` and then dispatch the task with \`dispatch_worker\`.

This route can return the worker result through the Chief-of-Staff flow without requiring a separate Cursor Agent window.

This route is useful for configured backend execution, custom models/providers, batch work, text-heavy work, or automation.

## Route choice

Do not silently choose the route for the user.

Briefly explain the effect of each route and ask which route the user wants when implementation is ready.

The user can change the route later by telling the Chief.

## Decision checkpoint before implementation

For vague product requests such as "I want to build an app", "I want to make a learning tool", or "help me build this product", do not implement yet.

First explain the Chief workflow and the two worker routes, then ask key product decisions, then provide recommendations.

First clarify or confirm key decisions:

- product type and MVP scope
- target user
- target platform, such as Web, Cursor project, mini program, desktop, or mobile
- data source, such as local mock data, user-provided files, or API
- backend/API choice
- login/auth timing
- local-only vs sync
- first runnable milestone
- preferred worker route: Cursor Agent Worker or External API Worker

Do not silently choose these for the user.

After the direction is clear, summarize the proposed MVP and ask whether to track tasks and prepare a worker handoff.

## Acknowledgement is not approval

Short acknowledgements such as "ok", "yes", "好", "可以", "继续", or "嗯" mean the user wants to continue the conversation.

They do not by themselves mean permission to:

- edit files
- register tasks with \`plan_tasks\`
- prepare a worker task package
- dispatch an external worker
- choose a platform, backend, login method, API route, or data source

Before tracking tasks or preparing implementation handoff, summarize the chosen direction and ask for explicit confirmation.

## Tool usage policy

Prefer Chief-of-Staff MCP tools when relevant:

- Use \`chief_doctor\` for project health or setup checks.
- Use \`chief_next_action\` when deciding what to do next.
- Use \`chief_audit\` for consistency, hidden issues, or release readiness.
- Use \`plan_tasks\` only when the user agrees the work should be tracked.
- Use \`prepare_cursor_agent_task\` to prepare Cursor Agent Worker handoffs.
- Use \`submit_worker_result\` to record worker results.
- Use \`chief_config_help\`, \`chief_external_preflight\`, and \`dispatch_worker\` for the External API Worker route.

Do not make the user manage raw tools. Explain the workflow in normal language.

## Preserve project memory

Before changing direction, check existing project state when useful.

Do not erase, replace, or ignore prior product decisions, tasks, or project memory unless the user explicitly confirms a direction change.

If the user's new request conflicts with existing state, ask for confirmation before changing direction.

## Recommended workflow

1. Understand the user's goal.
2. Check project state when useful.
3. Ask key decision questions before implementation.
4. Suggest one clear next action.
5. Track work as tasks when the user agrees.
6. Prepare a worker task package for implementation.
7. Let a Cursor Agent Worker or External API Worker execute the implementation.
8. Receive and record worker results.
9. Use doctor/audit tools to keep the project consistent.

## Cursor project context

Project-level MCP tools are reliable only inside the target project window.

If Chief-of-Staff tools are not visible, check:

- this project's \`.cursor/mcp.json\`
- whether the current Agent chat belongs to this project
- whether Cursor Home / global Agent is being used by mistake

## Tone

Be clear, calm, and operational.

Keep the user focused on product direction, decisions, and next action.
`;

function normalizeProjectRootForJson(projectRoot: string): string {
  const resolved = path.resolve(projectRoot);
  return resolved.replace(/\\/g, "/");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type McpConfigFile = {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
};

async function ensureMcpJson(
  projectRoot: string,
  cwdForJson: string,
  created: string[],
  skipped: string[],
  errors: string[]
): Promise<void> {
  const cursorDir = path.join(projectRoot, ".cursor");
  const mcpPath = path.join(cursorDir, "mcp.json");
  const chiefEntry = {
    command: "npx",
    args: ["-y", PACKAGE_NAME],
    cwd: cwdForJson
  };

  if (!(await pathExists(mcpPath))) {
    await mkdir(cursorDir, { recursive: true });
    const doc: McpConfigFile = {
      mcpServers: {
        "chief-of-staff": chiefEntry
      }
    };
    await writeFile(mcpPath, `${JSON.stringify(doc, null, 2)}\n`, "utf-8");
    created.push(".cursor/mcp.json");
    return;
  }

  let raw: string;
  try {
    raw = await readFile(mcpPath, "utf-8");
  } catch (e: unknown) {
    errors.push(`Cannot read .cursor/mcp.json: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    errors.push(
      ".cursor/mcp.json exists but is not valid JSON. Fix it manually, then run init again."
    );
    return;
  }

  if (!isPlainObject(parsed)) {
    errors.push(".cursor/mcp.json must be a JSON object. Fix it manually.");
    return;
  }

  const doc = parsed as McpConfigFile;
  const servers = doc.mcpServers;
  if (servers !== undefined && !isPlainObject(servers)) {
    errors.push(".cursor/mcp.json: mcpServers must be an object. Fix it manually.");
    return;
  }

  const mcpServers: Record<string, unknown> = isPlainObject(servers) ? { ...servers } : {};
  if (Object.prototype.hasOwnProperty.call(mcpServers, "chief-of-staff")) {
    skipped.push(".cursor/mcp.json (chief-of-staff entry already present)");
    return;
  }

  mcpServers["chief-of-staff"] = chiefEntry;
  const next: McpConfigFile = { ...doc, mcpServers };
  await writeFile(mcpPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  created.push(".cursor/mcp.json (merged chief-of-staff server)");
}

async function ensureRulesFile(
  projectRoot: string,
  created: string[],
  skipped: string[],
  errors: string[]
): Promise<void> {
  const rulesDir = path.join(projectRoot, ".cursor", "rules");
  const rulesPath = path.join(rulesDir, "chief-of-staff.mdc");

  if (await pathExists(rulesPath)) {
    skipped.push(".cursor/rules/chief-of-staff.mdc");
    return;
  }

  try {
    await mkdir(rulesDir, { recursive: true });
    await writeFile(rulesPath, DEFAULT_RULE_BODY, "utf-8");
    created.push(".cursor/rules/chief-of-staff.mdc");
  } catch (e: unknown) {
    errors.push(
      `Failed to write .cursor/rules/chief-of-staff.mdc: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export async function runInit(): Promise<number> {
  const projectRoot = process.cwd();
  const cwdForJson = normalizeProjectRootForJson(projectRoot);
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const baselineItems = await ensureChiefBaseline(projectRoot, { dryRun: false });
  for (const item of baselineItems) {
    if (item.kind === "manual") {
      errors.push(item.display);
    } else if (item.kind === "created" && item.relPath) {
      created.push(item.relPath);
    } else if (item.kind === "skipped_ok" && item.relPath) {
      skipped.push(`${item.relPath} (already present)`);
    }
  }

  if (errors.length > 0) {
    console.error("Chief-of-Staff init failed:\n");
    for (const line of errors) {
      console.error(`  - ${line}`);
    }
    return 1;
  }

  await ensureMcpJson(projectRoot, cwdForJson, created, skipped, errors);
  if (errors.length > 0) {
    console.error("Chief-of-Staff init failed:\n");
    for (const line of errors) {
      console.error(`  - ${line}`);
    }
    return 1;
  }

  await ensureRulesFile(projectRoot, created, skipped, errors);
  if (errors.length > 0) {
    console.error("Chief-of-Staff init failed:\n");
    for (const line of errors) {
      console.error(`  - ${line}`);
    }
    return 1;
  }

  const displayRoot = cwdForJson;
  console.log("Chief-of-Staff project initialized.\n");
  console.log("Project:");
  console.log(`  ${displayRoot}\n`);

  if (created.length > 0) {
    console.log("Created:");
    for (const line of created) {
      console.log(`  ${line}`);
    }
    console.log("");
  }

  if (skipped.length > 0) {
    console.log("Skipped:");
    for (const line of skipped) {
      console.log(`  ${line}`);
    }
    console.log("");
  }

  console.log("Next steps:");
  console.log("  1. Open this folder in Cursor.");
  console.log("  2. Reload or restart Cursor.");
  console.log(
    "  3. Make sure the `chief-of-staff` MCP server is enabled in Cursor settings."
  );
  console.log("  4. Start a new Agent chat inside this project window.");
  console.log("  5. Ask: \"What should we do next?\"");
  return 0;
}
