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

function fileScopeCountLines(task: Task): string {
  const lines: string[] = [];
  if (task.allowed_files?.length) {
    lines.push(`\n- 允许修改：${task.allowed_files.length} 项`);
  }
  if (task.forbidden_files?.length) {
    lines.push(`\n- 禁止修改：${task.forbidden_files.length} 项`);
  }
  return lines.join("");
}

function dependencyCountLines(task: Task): string {
  const lines: string[] = [];
  if (task.depends_on?.length) {
    lines.push(`\n- 依赖任务：${task.depends_on.length} 项`);
  }
  if (task.blocked_by?.length) {
    lines.push(`\n- 阻塞来源：${task.blocked_by.length} 项`);
  }
  return lines.join("");
}

export async function getWorkerSummary(rawInput: unknown): Promise<string> {
  const input: GetWorkerSummaryInput = getWorkerSummaryInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `Task ${input.task_id} not found.`;
  }

  const workerRoute = task.worker_route ?? "external";
  const laneLine = task.lane ? `\n- 任务线：${task.lane}` : "";
  const windowHintLine = task.window_hint ? `\n- 建议窗口：${task.window_hint}` : "";
  const fileScopeCountLine = fileScopeCountLines(task);
  const dependencyCountLine = dependencyCountLines(task);

  if (workerRoute === "cursor_agent" && task.status === "waiting_for_cursor_agent") {
    const suggested = task.suggested_model ?? task.model ?? "(未指定)";
    const pkg = task.agent_task_file ?? `.chief/agent-tasks/${task.id}.md`;
    return `**${task.id}** · waiting_for_cursor_agent · cursor_agent · 建议模型：${suggested}${laneLine}${windowHintLine}${dependencyCountLine}${fileScopeCountLine}

复制上一则 prepare_cursor_agent_task 返回里的任务包代码块，新建 Cursor Agent 窗口粘贴执行。必要时打开：${pkg}。需重发：再调 prepare_cursor_agent_task（同 task_id）。`;
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
- outcome：done
- 工兵路线：cursor_agent
- 工兵模型：cursor_agent / ${effective}
- 摘要：${task.summary ?? ""}${laneLine}${windowHintLine}${dependencyCountLine}${fileScopeCountLine}${resultFileLine}${note}`;
  }

  if (workerRoute === "cursor_agent" && task.status === "blocked") {
    const effective = effectiveModelForDisplay(task);
    const note = shouldShowCursorModelNote(task)
      ? `\n- 说明：实际模型未由 Cursor 暴露，按建议模型记录`
      : "";
    const resultFileLine = task.result_file
      ? `\n- 结果文件：${task.result_file}`
      : "";

    return `**${task.id}**

- 任务：${task.id}
- 状态：blocked
- outcome：blocked
- 工兵路线：cursor_agent
- 工兵模型：cursor_agent / ${effective}
- 摘要：${task.summary ?? ""}
- 需要：${task.needs?.trim() || "（未填）"}${laneLine}${windowHintLine}${dependencyCountLine}${fileScopeCountLine}${resultFileLine}${note}

下一步：用户或参谋补充信息后，可重新拆任务或新建任务继续。`;
  }

  if (workerRoute === "cursor_agent" && task.status === "failed") {
    const effective = effectiveModelForDisplay(task);
    const note = shouldShowCursorModelNote(task)
      ? `\n- 说明：实际模型未由 Cursor 暴露，按建议模型记录`
      : "";
    const resultFileLine = task.result_file
      ? `\n- 结果文件：${task.result_file}`
      : "";

    return `**${task.id}**

- 任务：${task.id}
- 状态：failed
- outcome：failed
- 工兵路线：cursor_agent
- 工兵模型：cursor_agent / ${effective}
- 摘要：${task.summary ?? ""}
- 错误：${task.error ?? ""}${laneLine}${windowHintLine}${dependencyCountLine}${fileScopeCountLine}${resultFileLine}${note}`;
  }

  const provider = task.provider ?? "unknown";
  const model = task.model ?? "unknown";
  const reportedModel = task.reported_model ? ` · reported_model=\`${task.reported_model}\`` : "";
  const resultFile = task.result_file ? `\n- result_file: \`${task.result_file}\`` : "";
  const header = `**${task.id}** · \`${task.status}\` · route=\`${workerRoute}\` · provider=\`${provider}\` · model=\`${model}\`${reportedModel}`;

  if (task.status !== "done" && task.status !== "blocked" && task.status !== "failed") {
    return `${header}

- 工兵路线：external
- 工兵模型：${provider} / ${model}
${dependencyCountLine}

Task ${task.id} is not done yet (status: ${task.status}).`;
  }

  return `${header}

- 工兵路线：external
- 工兵模型：${provider} / ${model}
${dependencyCountLine}

${resultFile}

${fileScopeCountLine}

${task.summary ?? ""}`;
}
