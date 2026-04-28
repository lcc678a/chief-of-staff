import { z } from "zod";
import { getTask } from "../lib/tasks_store.js";
import type { Task } from "../types.js";

export const getWorkerSummaryInputSchema = z.object({
  task_id: z.string()
});

type GetWorkerSummaryInput = z.infer<typeof getWorkerSummaryInputSchema>;

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

export async function getWorkerSummary(rawInput: unknown): Promise<string> {
  const input: GetWorkerSummaryInput = getWorkerSummaryInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `Task ${input.task_id} not found.`;
  }

  const workerRoute = task.worker_route ?? "external";

  if (workerRoute === "cursor_agent" && task.status === "waiting_for_cursor_agent") {
    const suggested = task.suggested_model ?? task.model ?? "(未指定)";
    const pkg = task.agent_task_file ?? `.chief/agent-tasks/${task.id}.md`;
    return `**${task.id}**

- 任务：${task.id}
- 状态：waiting_for_cursor_agent
- 工兵路线：cursor_agent
- 建议模型：${suggested}
- 备份文件：${pkg}

下一步：在 \`prepare_cursor_agent_task\` 工具结果的完整任务包代码块右上角复制，粘贴到 Cursor 工兵窗口执行（备份路径仅供必要时查阅：${pkg}）。`;
  }

  if (workerRoute === "cursor_agent" && task.status === "done") {
    const effective = effectiveModelForDisplay(task);
    const note = shouldShowCursorModelNote(task)
      ? `\n- 说明：实际模型未由 Cursor 暴露，按建议模型记录`
      : "";
    const resultFileLine = task.result_file
      ? `\n- 结果文件：${task.result_file}`
      : "";

    return `**${task.id}**

- 任务：${task.id}
- 状态：done
- 工兵路线：cursor_agent
- 工兵模型：cursor_agent / ${effective}
- 摘要：${task.summary ?? ""}${resultFileLine}${note}`;
  }

  const provider = task.provider ?? "unknown";
  const model = task.model ?? "unknown";
  const reportedModel = task.reported_model ? ` · reported_model=\`${task.reported_model}\`` : "";
  const resultFile = task.result_file ? `\n- result_file: \`${task.result_file}\`` : "";
  const header = `**${task.id}** · \`${task.status}\` · route=\`${workerRoute}\` · provider=\`${provider}\` · model=\`${model}\`${reportedModel}`;

  if (task.status !== "done") {
    return `${header}

Task ${task.id} is not done yet (status: ${task.status}).`;
  }

  return `${header}

${resultFile}

${task.summary ?? ""}`;
}
