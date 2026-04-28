import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ensureDefaultConfigFile } from "../lib/config.js";
import { CHIEF_DIR, CONFIG_FILE, PROJECT_ROOT, TASKS_FILE } from "../lib/paths.js";

export const chiefRepairInputSchema = z.object({
  dry_run: z.boolean().optional()
});

const AGENT_TASKS_DIR = path.join(CHIEF_DIR, "agent-tasks");
const RESULTS_DIR = path.join(CHIEF_DIR, "results");
const RULES_FILE = path.join(PROJECT_ROOT, ".cursor", "rules", "chief-of-staff.mdc");

const TASKS_EMPTY = "[]";

type TasksCheck = "missing" | "valid" | "invalid";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function checkTasksJson(): Promise<TasksCheck> {
  if (!(await pathExists(TASKS_FILE))) {
    return "missing";
  }
  try {
    const raw = await readFile(TASKS_FILE, "utf-8");
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
  repaired: string[],
  planned: string[],
  manual: string[]
): Promise<void> {
  if (await pathExists(dirPath)) {
    try {
      const s = await stat(dirPath);
      if (!s.isDirectory()) {
        manual.push(`\`${displayPath}\`：路径存在但不是目录，需人工处理`);
      }
    } catch {
      manual.push(`\`${displayPath}\`：无法访问，需人工处理`);
    }
    return;
  }
  if (dryRun) {
    planned.push(`将创建目录 \`${displayPath}\``);
    return;
  }
  await mkdir(dirPath, { recursive: true });
  repaired.push(`创建目录 \`${displayPath}\``);
}

export async function chiefRepair(rawInput: unknown): Promise<string> {
  const input = chiefRepairInputSchema.parse(rawInput);
  const dryRun = input.dry_run === true;

  const repaired: string[] = [];
  const planned: string[] = [];
  const ok: string[] = [];
  const manual: string[] = [];

  // .chief/
  try {
    if (!(await pathExists(CHIEF_DIR))) {
      if (dryRun) {
        planned.push("将创建目录 `.chief/`");
      } else {
        await mkdir(CHIEF_DIR, { recursive: true });
        repaired.push("创建 `.chief/`");
      }
    }
  } catch {
    manual.push("`.chief/`：无法创建，请检查权限或路径冲突");
  }

  // .chief/tasks.json
  const tasksCheck = await checkTasksJson();
  if (tasksCheck === "missing") {
    if (dryRun) {
      planned.push("将创建 `.chief/tasks.json`（内容为 `[]`）");
    } else {
      try {
        await writeFile(TASKS_FILE, `${TASKS_EMPTY}\n`, "utf-8");
        repaired.push("创建 `.chief/tasks.json`（`[]`）");
      } catch {
        manual.push("`.chief/tasks.json`：创建失败");
      }
    }
  } else if (tasksCheck === "invalid") {
    manual.push(
      "`.chief/tasks.json`：存在但无效（非合法 JSON 或非数组），**未覆盖**；请人工修复。"
    );
  } else {
    ok.push("`.chief/tasks.json`：存在且为 JSON 数组");
  }

  await ensureDirectory(AGENT_TASKS_DIR, ".chief/agent-tasks/", dryRun, repaired, planned, manual);
  await ensureDirectory(RESULTS_DIR, ".chief/results/", dryRun, repaired, planned, manual);

  // .chief/config.json
  if (await pathExists(CONFIG_FILE)) {
    ok.push("`.chief/config.json`：存在（未输出配置内容；不包含 API Key）");
  } else if (dryRun) {
    planned.push(
      "将创建默认 `.chief/config.json`（项目内置模板；**不**写入任何 API Key；密钥仍用环境变量）"
    );
  } else {
    try {
      await ensureDefaultConfigFile();
      repaired.push("创建默认 `.chief/config.json`（内置模板，未写入任何 API Key）");
    } catch {
      manual.push(
        "`.chief/config.json`：自动创建失败，请按项目说明手动配置（Cursor 工兵可先使用）"
      );
    }
  }

  // .cursor/rules/chief-of-staff.mdc
  if (await pathExists(RULES_FILE)) {
    ok.push("`.cursor/rules/chief-of-staff.mdc`：存在");
  } else {
    manual.push(
      "`.cursor/rules/chief-of-staff.mdc`：**不存在**，不自动生成；请从仓库或备份恢复规则文件。"
    );
  }

  const modeLine = dryRun ? "模式：预演（`dry_run=true`，不写入磁盘）" : "模式：实际修复";
  const lines: string[] = [`# Chief-of-Staff 修复`, ``, modeLine, ``];

  const actionSectionTitle = dryRun ? "## 预演：将执行的操作" : "## 已修复";
  const actionItems = dryRun ? planned : repaired;

  if (actionItems.length > 0) {
    lines.push(actionSectionTitle, "");
    for (const item of actionItems) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (ok.length > 0) {
    lines.push("## 正常", "");
    for (const item of ok) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (manual.length > 0) {
    lines.push("## 需要人工处理", "");
    for (const item of manual) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (actionItems.length === 0 && ok.length > 0 && manual.length === 0) {
    lines.push("当前检查路径均已就绪，无需创建或修复。", "");
  }

  return lines.join("\n").trimEnd() + "\n";
}
