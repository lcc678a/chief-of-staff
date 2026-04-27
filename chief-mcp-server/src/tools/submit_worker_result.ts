import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask, updateTask } from "../lib/tasks_store.js";

export const submitWorkerResultInputSchema = z.object({
  task_id: z.string(),
  reported_model: z.string().optional(),
  summary: z.string(),
  details: z.string()
});

type SubmitWorkerResultInput = z.infer<typeof submitWorkerResultInputSchema>;

function toResultRelativePath(taskId: string): string {
  return `.chief/results/${taskId}.md`;
}

export async function submitWorkerResult(rawInput: unknown): Promise<string> {
  const input: SubmitWorkerResultInput = submitWorkerResultInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `任务不存在：${input.task_id}`;
  }
  if (task.status !== "waiting_for_cursor_agent") {
    return `任务 ${input.task_id} 当前状态是 ${task.status}，只有 waiting_for_cursor_agent 才能提交 Cursor 工兵结果。`;
  }

  const reportedModel = input.reported_model?.trim() || "unknown";
  const resultRelativePath = toResultRelativePath(task.id);
  const resultAbsolutePath = path.join(PROJECT_ROOT, resultRelativePath);
  await mkdir(path.dirname(resultAbsolutePath), { recursive: true });

  const detailsContent = [
    `# ${task.id} Cursor Agent Result`,
    "",
    `- summary: ${input.summary}`,
    `- reported_model: ${reportedModel}`,
    `- submitted_at: ${new Date().toISOString()}`,
    "",
    "## Details",
    "",
    input.details
  ].join("\n");
  await writeFile(resultAbsolutePath, detailsContent, "utf-8");

  const finalModel = reportedModel !== "unknown" ? reportedModel : task.suggested_model ?? "user-selected";
  await updateTask(task.id, {
    status: "done",
    worker_route: "cursor_agent",
    reported_model: reportedModel,
    result_file: resultRelativePath,
    summary: input.summary,
    provider: "cursor_agent",
    model: finalModel,
    finished_at: new Date().toISOString(),
    error: undefined
  });

  return `已提交 Cursor 工兵结果：${task.id}

- 状态：done
- 工兵路线：Cursor Agent Worker
- reported_model：${reportedModel}
- 结果文件：${resultRelativePath}`;
}
