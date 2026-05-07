import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readConfig } from "../lib/config.js";
import { LOGS_DIR } from "../lib/paths.js";
import { getTask, readTasks, updateTask } from "../lib/tasks_store.js";
import type { ChiefConfig, ModelLevel, Task } from "../types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the absolute path of the compiled worker script.
 *
 * Production layout (npm/npx install):
 *   <pkg>/dist/tools/dispatch_worker.js  → "../workers/run_worker.js"
 *
 * Local dev layout (ts-node loads src/, compiled output sits next to src/):
 *   <pkg>/src/tools/dispatch_worker.ts   → "../../dist/workers/run_worker.js"
 *
 * The user project's CWD is irrelevant — never resolve the worker script
 * relative to the user project, because the package code lives in the npm
 * cache when installed via `npx chief-of-staff-mcp`.
 */
function resolveWorkerScriptPath(): string {
  const sibling = path.resolve(HERE, "..", "workers", "run_worker.js");
  if (existsSync(sibling)) {
    return sibling;
  }
  const devFallback = path.resolve(HERE, "..", "..", "dist", "workers", "run_worker.js");
  return devFallback;
}

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

  const workerScriptPath = resolveWorkerScriptPath();
  const relativeLogFile = `.chief/logs/${input.task_id}.log`;
  const logPath = path.join(LOGS_DIR, `${input.task_id}.log`);

  await mkdir(LOGS_DIR, { recursive: true });

  if (!existsSync(workerScriptPath)) {
    const at = new Date().toISOString();
    await appendFile(
      logPath,
      [
        "=== dispatch failure ===",
        `task_id=${input.task_id}`,
        `started_at=${at}`,
        `cwd=${process.cwd()}`,
        `worker_script=${workerScriptPath}`,
        `error=worker script not found`,
        ""
      ].join("\n"),
      "utf-8"
    );
    await updateTask(input.task_id, {
      status: "failed",
      worker_route: "external",
      provider: providerName,
      model,
      finished_at: new Date().toISOString(),
      error: `worker script not found: ${workerScriptPath}`,
      log_file: relativeLogFile,
      pid: undefined
    });
    return withHint(
      `派发失败：找不到工兵脚本 \`${workerScriptPath}\`。包安装可能不完整，请重装 \`chief-of-staff-mcp\`。`
    );
  }

  const dispatchStartedAt = new Date().toISOString();
  await appendFile(
    logPath,
    [
      "=== dispatch start ===",
      `task_id=${input.task_id}`,
      `started_at=${dispatchStartedAt}`,
      `cwd=${process.cwd()}`,
      `worker_script=${workerScriptPath}`,
      `provider=${providerName}`,
      `model=${model}`,
      `node=${process.execPath}`,
      ""
    ].join("\n"),
    "utf-8"
  );

  await updateTask(input.task_id, {
    status: "running",
    worker_route: "external",
    provider: providerName,
    model,
    started_at: dispatchStartedAt,
    finished_at: undefined,
    error: undefined,
    result_file: undefined,
    summary: undefined,
    log_file: relativeLogFile
  });

  const logFd = openSync(logPath, "a");
  let child;
  try {
    child = spawn(process.execPath, [workerScriptPath, input.task_id], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      cwd: process.cwd(),
      env: process.env
    });
  } catch (error) {
    closeSync(logFd);
    const message = error instanceof Error ? error.message : String(error);
    await appendFile(logPath, `\n=== dispatch spawn error ===\n${message}\n`, "utf-8");
    await updateTask(input.task_id, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error: `failed to spawn worker process: ${message}`,
      pid: undefined,
      log_file: relativeLogFile
    });
    return withHint(`派发失败：无法启动工兵进程：${message}`);
  }

  child.unref();
  closeSync(logFd);

  child.on("error", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    void (async () => {
      await appendFile(logPath, `\n=== dispatch spawn error ===\n${message}\n`, "utf-8");
      await updateTask(input.task_id, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error: `failed to spawn worker process: ${message}`,
        pid: undefined,
        log_file: relativeLogFile
      });
    })();
  });

  await updateTask(input.task_id, {
    pid: child.pid
  });

  const relativeResultFile = `.chief/results/${input.task_id}.md`;

  return `已派出 ${input.task_id}（**后台运行**，主参谋不需要原地等待）

- 状态：running
- 工兵路线：external
- 工兵模型：${providerName} / ${model}
- pid：${child.pid}
- log_file：\`${relativeLogFile}\`
- 预期结果文件（完成后写入 \`result_file\`）：\`${relativeResultFile}\`
- worker_script：\`${workerScriptPath}\`

下一步：
- 用户可以**继续与主参谋交流**，外部工兵在后台跑。
- 任务完成后会自动写入 \`${relativeResultFile}\`，并把 \`result_file\` / \`summary\` 写回 task。
- 主参谋默认**只读** \`get_worker_status\` / \`get_worker_summary\`（status / summary / result_file / log_file），**不**自动读取完整结果或完整日志，避免吃 token；用户明确要求时再打开 \`result_file\`。`;
}
