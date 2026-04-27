import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { readConfig } from "../lib/config.js";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask, updateTask } from "../lib/tasks_store.js";

export const dispatchWorkerInputSchema = z.object({
  task_id: z.string()
});

type DispatchWorkerInput = z.infer<typeof dispatchWorkerInputSchema>;

export async function dispatchWorker(rawInput: unknown): Promise<string> {
  const input: DispatchWorkerInput = dispatchWorkerInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `Task ${input.task_id} not found.`;
  }
  if (task.status !== "pending") {
    return `Task ${input.task_id} is ${task.status}, expected pending.`;
  }

  const config = await readConfig();
  const providerName = config.default_provider;
  const providerConfig = config.providers[providerName];
  if (!providerConfig) {
    return `派发失败：未找到 provider 配置（${providerName}）。`;
  }

  const model = providerConfig.models[task.model_level];
  if (!model) {
    return `派发失败：provider ${providerName} 未配置 model_level=${task.model_level} 的模型。`;
  }

  await updateTask(input.task_id, {
    status: "running",
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
