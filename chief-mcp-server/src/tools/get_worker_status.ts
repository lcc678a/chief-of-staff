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

    return `**${task.id}** · \`${task.status}\` · cursor_agent${outcomeLine}

工兵模型：cursor_agent / ${displayModel}${note}${summaryLine}${needsLine}${errLine}${agentFileLine}${resultFileLine}

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
  const resultText = task.result_file ? ` · result_file=${task.result_file}` : "";
  const tailLine =
    task.status === "done"
      ? ` · summary=${task.summary ?? "(empty)"}`
      : task.status === "failed"
        ? ` · error=${task.error ?? "(unknown)"}`
        : "";

  return `**${task.id}** · \`${task.status}\` · route=\`${workerRoute}\` · provider=\`${provider}\` · model=\`${model}\`${pidText}${resultText}${tailLine}

<details>
<summary>📜 最近日志（最后 20 行）</summary>

\`\`\`
${logs}
\`\`\`
</details>`;
}
