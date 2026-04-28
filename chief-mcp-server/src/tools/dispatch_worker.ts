import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { readConfig } from "../lib/config.js";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask, readTasks, updateTask } from "../lib/tasks_store.js";
import type { ChiefConfig, ModelLevel, Task } from "../types.js";

export const dispatchWorkerInputSchema = z.object({
  task_id: z.string(),
  provider: z.string().optional(),
  model: z.string().optional()
});

type DispatchWorkerInput = z.infer<typeof dispatchWorkerInputSchema>;

const HELP_DISPATCH_HINT =
  "建议先运行 `chief_external_preflight` 检查 task/provider/model/API Key/依赖状态；如需查看配置结构，运行 `chief_config_help`。";

function withHint(body: string): string {
  return `${body}\n\n${HELP_DISPATCH_HINT}`;
}

function normalizeModelLevel(task: Task): ModelLevel {
  const l = task.model_level;
  if (l === "cheap" || l === "smart" || l === "genius") {
    return l;
  }
  return "smart";
}

function dependsOnLines(allTasks: Task[], task: Task): string[] | null {
  const deps = task.depends_on ?? [];
  if (deps.length === 0) {
    return null;
  }
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const lines: string[] = [];
  let ok = true;
  for (const depId of deps) {
    const dep = byId.get(depId);
    if (!dep) {
      ok = false;
      lines.push(`  - ${depId}：未找到`);
    } else if (dep.status !== "done") {
      ok = false;
      lines.push(`  - ${depId}：${dep.status}`);
    }
  }
  return ok ? null : lines;
}

export async function dispatchWorker(rawInput: unknown): Promise<string> {
  const input: DispatchWorkerInput = dispatchWorkerInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return withHint(`找不到任务：${input.task_id}`);
  }
  if (task.status !== "pending") {
    return withHint(
      `无法派发外部工兵：任务 ${input.task_id} 当前状态为 ${task.status}，需要 pending。`
    );
  }

  const explicitProviderOrModel = input.provider !== undefined || input.model !== undefined;
  if (task.worker_route === "cursor_agent" && !explicitProviderOrModel) {
    return `该任务当前标记为 Cursor 工兵任务，未显式指定 provider/model，因此未派发外部工兵。

如确实要用外部 API 工兵，请重新调用 dispatch_worker 并显式传入 provider 或 model，或调整任务路线。`;
  }

  let allTasks: Task[];
  try {
    allTasks = await readTasks();
  } catch {
    return withHint(`无法读取任务列表：.chief/tasks.json 无效或无法解析。`);
  }

  const depLines = dependsOnLines(allTasks, task);
  if (depLines) {
    return [
      `无法派发外部工兵：依赖尚未完成。`,
      ``,
      `- **当前任务**：${input.task_id}`,
      `- **未完成依赖**：`,
      ...depLines,
      ``,
      `建议先完成依赖任务，或运行 \`chief_external_preflight\` 查看派发前检查。`
    ].join("\n");
  }

  let config: ChiefConfig;
  try {
    config = await readConfig();
  } catch {
    return withHint(`无法读取 .chief/config.json（文件缺失或 JSON 无效）。`);
  }

  const providerName = input.provider ?? task.provider ?? config.default_provider;
  const providerConfig = config.providers[providerName];
  if (!providerConfig) {
    return withHint(`派发失败：未找到 provider 配置（${providerName}）。`);
  }

  const model =
    input.model ?? task.model ?? providerConfig.models[normalizeModelLevel(task)];
  if (!model) {
    return withHint(
      `派发失败：provider ${providerName} 未配置 model_level=${normalizeModelLevel(task)} 的模型。`
    );
  }

  const envName = providerConfig.api_key_env?.trim();
  if (!envName) {
    return withHint(`派发失败：provider ${providerName} 未配置 api_key_env。`);
  }
  if (!process.env[envName]) {
    return withHint(`派发失败：环境变量 ${envName} 未设置（不在此显示变量值）。`);
  }

  await updateTask(input.task_id, {
    status: "running",
    worker_route: "external",
    provider: providerName,
    model,
    started_at: new Date().toISOString(),
    finished_at: undefined,
    error: undefined
  });

  const workerScriptPath = path.join(PROJECT_ROOT, "chief-mcp-server", "dist", "workers", "run_worker.js");
  const child = spawn("node", [workerScriptPath, input.task_id], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"]
  });
  child.unref();

  await updateTask(input.task_id, {
    pid: child.pid
  });

  return `已派出 ${input.task_id}

- 状态：running
- 工兵模型：${providerName} / ${model}
- pid：${child.pid}`;
}
