import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask } from "../lib/tasks_store.js";
import type { Task } from "../types.js";

export const getWorkerStatusInputSchema = z.object({
  task_id: z.string()
});

type GetWorkerStatusInput = z.infer<typeof getWorkerStatusInputSchema>;

function tailLines(text: string, n: number): string {
  const lines = text.split(/\r?\n/);
  return lines.slice(-n).join("\n");
}

async function readLastLogLines(taskLogFile: string | undefined, n: number): Promise<string> {
  if (!taskLogFile) {
    return "(no log file)";
  }
  const absolutePath = path.join(PROJECT_ROOT, taskLogFile);
  try {
    const content = await readFile(absolutePath, "utf-8");
    return tailLines(content, n) || "(log is empty)";
  } catch {
    return "(log not found)";
  }
}

function effectiveModelForDisplay(task: Task): string {
  return task.model ?? task.reported_model ?? task.suggested_model ?? "unknown";
}

function shouldShowCursorModelNote(task: Task): boolean {
  return (
    task.worker_route === "cursor_agent" &&
    task.reported_model === "unknown" &&
    !!task.suggested_model &&
    task.suggested_model !== "user-selected"
  );
}

function formatFileScopeSection(task: Task): string {
  const allowed = task.allowed_files?.length ? task.allowed_files : undefined;
  const forbidden = task.forbidden_files?.length ? task.forbidden_files : undefined;
  if (!allowed && !forbidden) {
    return "";
  }

  const parts: string[] = [];
  if (allowed) {
    parts.push(`\n允许修改：\n${allowed.map((item) => `- ${item}`).join("\n")}`);
  }
  if (forbidden) {
    parts.push(`\n禁止修改：\n${forbidden.map((item) => `- ${item}`).join("\n")}`);
  }
  return parts.join("");
}

function formatDependencySection(task: Task): string {
  const dependsOn = task.depends_on?.length ? task.depends_on : undefined;
  const blockedBy = task.blocked_by?.length ? task.blocked_by : undefined;
  if (!dependsOn && !blockedBy) {
    return "";
  }

  const parts: string[] = [];
  if (dependsOn) {
    parts.push(`\n依赖任务：\n${dependsOn.map((item) => `- ${item}`).join("\n")}`);
  }
  if (blockedBy) {
    parts.push(`\n阻塞来源：\n${blockedBy.map((item) => `- ${item}`).join("\n")}`);
  }
  return parts.join("");
}

export async function getWorkerStatus(rawInput: unknown): Promise<string> {
  const input: GetWorkerStatusInput = getWorkerStatusInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `Task ${input.task_id} not found.`;
  }

  const logs = await readLastLogLines(task.log_file ?? `.chief/logs/${task.id}.log`, 20);
  const workerRoute = task.worker_route ?? "external";

  if (workerRoute === "cursor_agent") {
    const displayModel = effectiveModelForDisplay(task);
    const laneLine = task.lane ? `\n任务线：${task.lane}` : "";
    const windowHintLine = task.window_hint ? `\n建议窗口：${task.window_hint}` : "";
    const note = shouldShowCursorModelNote(task)
      ? `\n说明：实际模型未由 Cursor 暴露，按建议模型记录。`
      : "";
    const agentFileLine = task.agent_task_file ? `\n任务包文件：\`${task.agent_task_file}\`` : "";
    const resultFileLine = task.result_file ? `\n结果文件：\`${task.result_file}\`` : "";
    const outcomeLine = task.outcome ? `\noutcome：${task.outcome}` : "";
    const summaryLine =
      task.summary && ["done", "blocked", "failed"].includes(task.status)
        ? `\n摘要：${task.summary}`
        : "";
    const needsLine =
      task.status === "blocked" ? `\n需要：${task.needs?.trim() || "（未填）"}` : "";
    const errLine =
      task.error && (task.status === "blocked" || task.status === "failed")
        ? `\n错误/阻塞信息：${task.error}`
        : "";
    const fileScopeLine = formatFileScopeSection(task);
    const dependencyLine = formatDependencySection(task);

    return `**${task.id}** · \`${task.status}\` · cursor_agent${outcomeLine}

工兵模型：cursor_agent / ${displayModel}${laneLine}${windowHintLine}${note}${summaryLine}${needsLine}${errLine}${dependencyLine}${fileScopeLine}${agentFileLine}${resultFileLine}

<details>
<summary>📜 最近日志（最后 20 行）</summary>

\`\`\`
${logs}
\`\`\`
</details>`;
  }

  const provider = task.provider ?? "unknown";
  const model = task.model ?? "unknown";
  const pidText = task.pid ? ` · pid=${task.pid}` : "";
  const resultFile = task.result_file ?? `.chief/results/${task.id}.md`;
  const logFile = task.log_file ?? `.chief/logs/${task.id}.log`;
  const tailLine =
    task.status === "done"
      ? ` · summary=${task.summary ?? "(empty)"}`
      : task.status === "failed"
        ? ` · error=${task.error ?? "(unknown)"}`
        : "";
  const fileScopeLine = formatFileScopeSection(task);
  const dependencyLine = formatDependencySection(task);

  const backgroundHint =
    task.status === "running"
      ? "\n\n说明：外部 API 工兵在**后台**运行，主参谋无需原地等待；用户可继续与主参谋交流。再次需要查询时再调用 `get_worker_status`。"
      : "";

  const readingHint =
    task.status === "done" || task.status === "failed"
      ? "\n\n注意：默认**不要**自动打开 `result_file` 或完整日志，避免吃 token；用户明确要求时再读 `result_file`。"
      : "";

  return `**${task.id}** · \`${task.status}\` · route=\`${workerRoute}\` · provider=\`${provider}\` · model=\`${model}\`${pidText}${tailLine}

- 工兵路线：external
- 工兵模型：${provider} / ${model}
- result_file：\`${resultFile}\`${task.result_file ? "" : "（尚未生成）"}
- log_file：\`${logFile}\`${dependencyLine}${fileScopeLine}

<details>
<summary>📜 最近日志（最后 20 行）</summary>

\`\`\`
${logs}
\`\`\`
</details>${backgroundHint}${readingHint}`;
}
