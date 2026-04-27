import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask } from "../lib/tasks_store.js";

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

export async function getWorkerStatus(rawInput: unknown): Promise<string> {
  const input: GetWorkerStatusInput = getWorkerStatusInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `Task ${input.task_id} not found.`;
  }

  const logs = await readLastLogLines(task.log_file ?? `.chief/logs/${task.id}.log`, 20);
  const provider = task.provider ?? "unknown";
  const model = task.model ?? "unknown";
  const pidText = task.pid ? ` · pid=${task.pid}` : "";
  const tailLine =
    task.status === "done"
      ? ` · summary=${task.summary ?? "(empty)"}`
      : task.status === "failed"
        ? ` · error=${task.error ?? "(unknown)"}`
        : "";

  return `**${task.id}** · \`${task.status}\` · provider=\`${provider}\` · model=\`${model}\`${pidText}${tailLine}

<details>
<summary>📜 最近日志（最后 20 行）</summary>

\`\`\`
${logs}
\`\`\`
</details>`;
}
