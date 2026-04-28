import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
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

请先初始化 .chief/tasks.json，或运行项目初始化流程。`;
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

请检查 .chief/tasks.json 是否为合法 JSON。`;
  }

  const agentTasksExists = await exists(path.join(PROJECT_ROOT, ".chief", "agent-tasks"));
  const resultsExists = await exists(path.join(PROJECT_ROOT, ".chief", "results"));
  const cursorRulesExists = await exists(
    path.join(PROJECT_ROOT, ".cursor", "rules", "chief-of-staff.mdc")
  );

  if (tasks.length === 0) {
    return `# Chief-of-Staff 体检

- tasks.json：正常
- 任务总数：0
- agent-tasks：${agentTasksExists ? "存在" : "不存在"}
- results：${resultsExists ? "存在" : "不存在"}
- Cursor rules：${cursorRulesExists ? "存在" : "不存在"}

## 建议下一步

可以让参谋登记一个新任务。`;
  }

  const counts = buildStatusCount(tasks);
  const blockedTasks = tasks.filter((task) => task.status === "blocked").slice(0, 5);
  const waitingTasks = tasks
    .filter((task) => task.status === "waiting_for_cursor_agent")
    .slice(0, 5);

  const notices: string[] = [];
  for (const task of blockedTasks) {
    notices.push(`- ${task.id} blocked：${blockedReason(task)}`);
  }
  for (const task of waitingTasks) {
    notices.push(`- ${task.id} waiting_for_cursor_agent：${waitingReason(task)}`);
  }

  const nextStep =
    blockedTasks.length > 0
      ? "先处理 blocked 任务；如果没有 blocked，就继续等待或重发 waiting 任务包。"
      : "继续等待或重发 waiting 任务包。";

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
- Cursor rules：${cursorRulesExists ? "存在" : "不存在"}${noticeSection}
## 建议下一步

${nextStep}`;
}
