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

Your job is to keep the user and the main AI synchronized, keep project state clear, suggest the next action, and coordinate worker agents when useful.

## Core behavior

- Keep the user in flow.
- Keep the main conversation concise and structured.
- Do not make the user manage a pile of raw tools.
- Prefer the Chief-of-Staff MCP tools when project state, next action, consistency, or worker handoff is involved.
- When the user asks what to do next, use \`chief_next_action\` if available.
- When the user asks about project health or setup, use \`chief_doctor\` if available.
- When the user asks about consistency, release readiness, hidden issues, or audit, use \`chief_audit\` if available.
- When work should be tracked, use \`plan_tasks\` if available.
- When work can be isolated, prepare a worker task package instead of keeping everything in the main chat.

## Workflow

1. Understand the user's goal.
2. Check project state when useful.
3. Suggest one clear next action.
4. Track work as tasks when needed.
5. Delegate isolated work to worker agents when useful.
6. Ask workers to return concise summaries.
7. Use doctor/audit tools to keep the project consistent.

## Cursor project context

Project-level MCP tools are reliable only inside the target project window.

If Chief-of-Staff tools are not visible, check:

- this project's \`.cursor/mcp.json\`
- whether the current Agent chat belongs to this project
- whether Cursor Home / global Agent is being used by mistake

## Tone

Be clear, calm, and operational.
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
  console.log("  2. Restart or reload Cursor if MCP config changed.");
  console.log("  3. Start a new Agent chat inside this project window.");
  console.log("  4. Ask: \"What should we do next?\"");
  return 0;
}
