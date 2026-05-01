import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDefaultConfigFileAt } from "./config.js";

const TASKS_EMPTY = "[]";

type TasksCheck = "missing" | "valid" | "invalid";

export type ChiefBaselineItem =
  | { kind: "created"; display: string; relPath?: string }
  | { kind: "planned"; display: string; relPath?: string }
  | { kind: "skipped_ok"; display: string; relPath?: string }
  | { kind: "manual"; display: string; relPath?: string };

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function checkTasksJson(tasksFile: string): Promise<TasksCheck> {
  if (!(await pathExists(tasksFile))) {
    return "missing";
  }
  try {
    const raw = await readFile(tasksFile, "utf-8");
    const cleaned = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(cleaned) as unknown;
    return Array.isArray(parsed) ? "valid" : "invalid";
  } catch {
    return "invalid";
  }
}

async function ensureDirectory(
  dirPath: string,
  displayPath: string,
  dryRun: boolean,
  items: ChiefBaselineItem[]
): Promise<void> {
  if (await pathExists(dirPath)) {
    try {
      const s = await stat(dirPath);
      if (!s.isDirectory()) {
        items.push({
          kind: "manual",
          display: `\`${displayPath}\`：路径存在但不是目录，需人工处理`,
          relPath: displayPath.replace(/^`|`$/g, "")
        });
      } else {
        items.push({
          kind: "skipped_ok",
          display: `\`${displayPath}\`：已存在`,
          relPath: displayPath.replace(/^`|`$/g, "")
        });
      }
    } catch {
      items.push({
        kind: "manual",
        display: `\`${displayPath}\`：无法访问，需人工处理`,
        relPath: displayPath.replace(/^`|`$/g, "")
      });
    }
    return;
  }
  if (dryRun) {
    items.push({
      kind: "planned",
      display: `将创建目录 \`${displayPath}\``,
      relPath: displayPath.replace(/^`|`$/g, "")
    });
    return;
  }
  await mkdir(dirPath, { recursive: true });
  items.push({
    kind: "created",
    display: `创建目录 \`${displayPath}\``,
    relPath: displayPath.replace(/^`|`$/g, "")
  });
}

export type EnsureChiefBaselineOptions = {
  dryRun?: boolean;
};

/**
 * Create `.chief/` baseline dirs and default files when missing.
 * Does not overwrite existing files. Used by chief_repair and CLI init.
 */
export async function ensureChiefBaseline(
  projectRoot: string,
  options: EnsureChiefBaselineOptions = {}
): Promise<ChiefBaselineItem[]> {
  const dryRun = options.dryRun === true;
  const items: ChiefBaselineItem[] = [];
  const chiefDir = path.join(projectRoot, ".chief");
  const tasksFile = path.join(chiefDir, "tasks.json");
  const agentTasksDir = path.join(chiefDir, "agent-tasks");
  const resultsDir = path.join(chiefDir, "results");
  const configFile = path.join(chiefDir, "config.json");

  try {
    if (!(await pathExists(chiefDir))) {
      if (dryRun) {
        items.push({ kind: "planned", display: "将创建目录 `.chief/`", relPath: ".chief/" });
      } else {
        await mkdir(chiefDir, { recursive: true });
        items.push({ kind: "created", display: "创建 `.chief/`", relPath: ".chief/" });
      }
    }
  } catch {
    items.push({ kind: "manual", display: "`.chief/`：无法创建，请检查权限或路径冲突" });
    return items;
  }

  const tasksCheck = await checkTasksJson(tasksFile);
  if (tasksCheck === "missing") {
    if (dryRun) {
      items.push({
        kind: "planned",
        display: "将创建 `.chief/tasks.json`（内容为 `[]`）",
        relPath: ".chief/tasks.json"
      });
    } else {
      try {
        await writeFile(tasksFile, `${TASKS_EMPTY}\n`, "utf-8");
        items.push({
          kind: "created",
          display: "创建 `.chief/tasks.json`（`[]`）",
          relPath: ".chief/tasks.json"
        });
      } catch {
        items.push({ kind: "manual", display: "`.chief/tasks.json`：创建失败" });
      }
    }
  } else if (tasksCheck === "invalid") {
    items.push({
      kind: "manual",
      display: "`.chief/tasks.json`：存在但无效（非合法 JSON 或非数组），**未覆盖**；请人工修复。"
    });
  } else {
    items.push({
      kind: "skipped_ok",
      display: "`.chief/tasks.json`：存在且为 JSON 数组",
      relPath: ".chief/tasks.json"
    });
  }

  await ensureDirectory(agentTasksDir, ".chief/agent-tasks/", dryRun, items);
  await ensureDirectory(resultsDir, ".chief/results/", dryRun, items);

  if (await pathExists(configFile)) {
    items.push({
      kind: "skipped_ok",
      display: "`.chief/config.json`：存在（未输出配置内容；不包含 API Key）",
      relPath: ".chief/config.json"
    });
  } else if (dryRun) {
    items.push({
      kind: "planned",
      display:
        "将创建默认 `.chief/config.json`（项目内置模板；**不**写入任何 API Key；密钥仍用环境变量）"
    });
  } else {
    try {
      await ensureDefaultConfigFileAt(projectRoot);
      items.push({
        kind: "created",
        display: "创建默认 `.chief/config.json`（内置模板，未写入任何 API Key）",
        relPath: ".chief/config.json"
      });
    } catch {
      items.push({
        kind: "manual",
        display:
          "`.chief/config.json`：自动创建失败，请按项目说明手动配置（Cursor 工兵可先使用）"
      });
    }
  }

  return items;
}
