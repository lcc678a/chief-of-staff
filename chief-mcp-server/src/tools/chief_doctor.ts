import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { readConfigSafe } from "../lib/config.js";
import { PROJECT_ROOT, TASKS_FILE } from "../lib/paths.js";
import type { Task, TaskStatus } from "../types.js";

export const chiefDoctorInputSchema = z.object({});

const TRACKED_STATUSES: TaskStatus[] = [
  "pending",
  "waiting_for_cursor_agent",
  "running",
  "done",
  "blocked",
  "failed"
];

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildStatusCount(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    pending: 0,
    waiting_for_cursor_agent: 0,
    running: 0,
    done: 0,
    blocked: 0,
    failed: 0
  };

  for (const task of tasks) {
    if (TRACKED_STATUSES.includes(task.status)) {
      counts[task.status] += 1;
    }
  }

  return counts;
}

function blockedReason(task: Task): string {
  return task.needs?.trim() || task.summary?.trim() || task.error?.trim() || task.description;
}

function waitingReason(task: Task): string {
  return task.summary?.trim() || "等待 Cursor 工兵执行";
}

export async function chiefDoctor(rawInput: unknown): Promise<string> {
  chiefDoctorInputSchema.parse(rawInput);

  const taskFileExists = await exists(TASKS_FILE);
  if (!taskFileExists) {
    return `# Chief-of-Staff 体检

- tasks.json：不存在

## 建议下一步

可调用 MCP 工具 \`chief_repair\`（可先 \`dry_run: true\` 预演）创建缺失的 \`.chief/\` 与空的 \`tasks.json\`，或按项目说明手动初始化。`;
  }

  let tasks: Task[];
  try {
    const raw = await readFile(TASKS_FILE, "utf-8");
    const cleaned = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(cleaned) as unknown;
    tasks = Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch {
    return `# Chief-of-Staff 体检

- tasks.json：无法解析

## 建议下一步

请检查 .chief/tasks.json 是否为合法 JSON。**不要**指望工具自动覆盖损坏文件；需人工修复后可用 \`chief_doctor\` 复检。`;
  }

  const agentTasksExists = await exists(path.join(PROJECT_ROOT, ".chief", "agent-tasks"));
  const resultsExists = await exists(path.join(PROJECT_ROOT, ".chief", "results"));
  const cursorRulesExists = await exists(
    path.join(PROJECT_ROOT, ".cursor", "rules", "chief-of-staff.mdc")
  );
  const config = await readConfigSafe();
  const provider = config?.default_provider ?? "未知";
  const providerConfig = provider !== "未知" ? config?.providers?.[provider] : undefined;
  const model = providerConfig?.models?.smart ?? providerConfig?.models?.cheap ?? "未知";
  const keyEnvName = providerConfig?.api_key_env;
  const apiKeyStatus = keyEnvName
    ? (process.env[keyEnvName] ? "已配置（不显示内容）" : "未配置")
    : "未检查";
  const routeSection = `\n## 工兵路线\n\n- Cursor 工兵：可用，用于本地交互式任务包执行\n- 外部 API 工兵：保留，用于自定义 API 模型和自动化任务\n  - provider：${provider}\n  - model：${model}\n  - API Key：${apiKeyStatus}\n  - 配置诊断：如需检查外部 API 的 provider / model / API Key 环境变量，请运行 \`chief_config_help\`。\n`;

  if (tasks.length === 0) {
    return `# Chief-of-Staff 体检

- tasks.json：正常
- 任务总数：0
- agent-tasks：${agentTasksExists ? "存在" : "不存在"}
- results：${resultsExists ? "存在" : "不存在"}
- Cursor rules：${cursorRulesExists ? "存在" : "不存在"}${routeSection}

## 建议下一步

可以让参谋登记一个新任务。`;
  }

  const counts = buildStatusCount(tasks);
  const blockedTasks = tasks.filter((task) => task.status === "blocked").slice(0, 5);
  const waitingTasks = tasks
    .filter((task) => task.status === "waiting_for_cursor_agent")
    .slice(0, 5);
  const blockedByTasks = tasks
    .filter((task) => (task.blocked_by?.length ?? 0) > 0)
    .slice(0, 5);
  const hasDependsOnTasks = tasks.some((task) => (task.depends_on?.length ?? 0) > 0);

  const notices: string[] = [];
  for (const task of blockedTasks) {
    notices.push(`- ${task.id} blocked：${blockedReason(task)}`);
  }
  for (const task of waitingTasks) {
    notices.push(`- ${task.id} waiting_for_cursor_agent：${waitingReason(task)}`);
  }
  for (const task of blockedByTasks) {
    notices.push(`- ${task.id} 被依赖阻塞：${task.blocked_by?.join("、")}`);
  }
  if (hasDependsOnTasks) {
    notices.push("- 存在 depends_on 依赖关系：请按前后顺序推进任务。");
  }

  const nextStep =
    blockedTasks.length > 0
      ? "先处理 blocked 任务；如果没有 blocked，就继续等待或重发 waiting 任务包。依赖不会自动执行，需要先完成前置任务。"
      : "继续等待或重发 waiting 任务包。依赖不会自动执行，需要先完成前置任务。";

  const noticeSection =
    notices.length > 0
      ? `\n## 需要注意\n\n${notices.join("\n")}\n`
      : "";

  return `# Chief-of-Staff 体检

- tasks.json：正常
- 任务总数：${tasks.length}
- pending：${counts.pending}
- waiting_for_cursor_agent：${counts.waiting_for_cursor_agent}
- running：${counts.running}
- done：${counts.done}
- blocked：${counts.blocked}
- failed：${counts.failed}
- agent-tasks：${agentTasksExists ? "存在" : "不存在"}
- results：${resultsExists ? "存在" : "不存在"}
- Cursor rules：${cursorRulesExists ? "存在" : "不存在"}${noticeSection}${routeSection}
## 建议下一步

${nextStep}`;
}
