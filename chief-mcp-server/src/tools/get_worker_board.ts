import { access, readFile } from "node:fs/promises";
import { z } from "zod";
import { TASKS_FILE } from "../lib/paths.js";
import type { Task, TaskStatus } from "../types.js";

export const getWorkerBoardInputSchema = z.object({});

const DISPLAY_STATUSES: TaskStatus[] = [
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

function listIdsByStatus(tasks: Task[], status: TaskStatus): string {
  const ids = tasks.filter((task) => task.status === status).map((task) => task.id);
  if (ids.length === 0) {
    return "无";
  }
  const preview = ids.slice(0, 5);
  return ids.length > 5 ? `${preview.join("、")}（另有 ${ids.length - 5} 个）` : preview.join("、");
}

function laneOf(task: Task): string {
  const lane = task.lane?.trim();
  return lane && lane.length > 0 ? lane : "general";
}

function windowHintOfLane(tasks: Task[], lane: string): string {
  const withWindowHint = tasks.find((task) => task.window_hint?.trim());
  if (withWindowHint?.window_hint) {
    return withWindowHint.window_hint.trim();
  }
  return `Cursor 工兵 - ${lane}`;
}

function laneRouteLabel(tasks: Task[]): string {
  const routes = new Set(
    tasks.map((task) => task.worker_route ?? "external")
  );
  if (routes.size > 1) {
    return "mixed";
  }
  return routes.has("cursor_agent") ? "cursor_agent" : "external";
}

export async function getWorkerBoard(rawInput: unknown): Promise<string> {
  getWorkerBoardInputSchema.parse(rawInput);

  const taskFileExists = await exists(TASKS_FILE);
  if (!taskFileExists) {
    return `# 工兵看板

- tasks.json：不存在

## 建议下一步

请先初始化 .chief/tasks.json，或先登记一个新任务。`;
  }

  let tasks: Task[];
  try {
    const raw = await readFile(TASKS_FILE, "utf-8");
    const cleaned = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(cleaned) as unknown;
    tasks = Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch {
    return `# 工兵看板

- tasks.json：无法解析

## 建议下一步

请检查 .chief/tasks.json 是否为合法 JSON。`;
  }

  if (tasks.length === 0) {
    return `# 工兵看板

当前没有任务，可以先登记一个新任务。`;
  }

  const laneMap = new Map<string, Task[]>();
  for (const task of tasks) {
    const lane = laneOf(task);
    const group = laneMap.get(lane) ?? [];
    group.push(task);
    laneMap.set(lane, group);
  }

  const laneBlocks = [...laneMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lane, laneTasks]) => {
      const windowHint = windowHintOfLane(laneTasks, lane);
      const routeLabel = laneRouteLabel(laneTasks);
      const statusLines = DISPLAY_STATUSES.map(
        (status) => `- ${status}：${listIdsByStatus(laneTasks, status)}`
      ).join("\n");
      return `## ${lane}
- 建议窗口：${windowHint}
- 工兵路线：${routeLabel}
${statusLines}`;
    })
    .join("\n\n");

  return `# 工兵看板

说明：以下是 Chief-of-Staff 记录的任务线、建议窗口和工兵路线。Cursor 真实窗口名可能由 Cursor 自动生成；外部 API 工兵没有 Cursor 窗口。

${laneBlocks}

## 建议下一步

优先处理 blocked；其次处理 waiting_for_cursor_agent；避免并行修改同一文件范围。`;
}
