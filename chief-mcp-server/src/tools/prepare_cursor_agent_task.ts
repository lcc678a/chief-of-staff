import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask, updateTask } from "../lib/tasks_store.js";
import type { Task } from "../types.js";

const COPY_THIS_CURSOR_AGENT_TASK_PACKAGE_START = "COPY_THIS_CURSOR_AGENT_TASK_PACKAGE_START";
const COPY_THIS_CURSOR_AGENT_TASK_PACKAGE_END = "COPY_THIS_CURSOR_AGENT_TASK_PACKAGE_END";
const USER_VISIBLE_CURSOR_AGENT_HANDOFF_START = "USER_VISIBLE_CURSOR_AGENT_HANDOFF_START";
const USER_VISIBLE_CURSOR_AGENT_HANDOFF_END = "USER_VISIBLE_CURSOR_AGENT_HANDOFF_END";

export const prepareCursorAgentTaskInputSchema = z.object({
  task_id: z.string(),
  suggested_model: z.string().optional(),
  extra_instructions: z.string().optional()
});

type PrepareCursorAgentTaskInput = z.infer<typeof prepareCursorAgentTaskInputSchema>;

function buildAgentTaskMarkdown(
  taskId: string,
  taskDescription: string,
  suggestedModel: string,
  extraInstructionsBlock: string,
  submitExampleReportedModel: string
): string {
  return `你是 Chief-of-Staff 的 Cursor 工兵 Agent。

任务 ID：${taskId}
建议模型：${suggestedModel}

任务描述：
${taskDescription}
${extraInstructionsBlock}
执行要求：
1. 只完成这个任务，不要顺手做无关优化。
2. 如果需要读取项目文件，可以读取必要文件。
3. 不要修改代码，除非任务描述明确要求。
4. 不要硬做、不要编造、不要把半成品当完成。
5. reported_model：知道实际模型填实际模型；不知道就填建议模型 ${suggestedModel}；不要轻易填 unknown。

回传（MCP：submit_worker_result）：

如果你完成了任务，调用：

submit_worker_result({
  "task_id": "${taskId}",
  "outcome": "done",
  "reported_model": "${submitExampleReportedModel}",
  "summary": "一句话摘要",
  "details": "详细结果"
})

如果你被阻塞，不要硬做、不要编造结果。调用：

submit_worker_result({
  "task_id": "${taskId}",
  "outcome": "blocked",
  "reported_model": "${submitExampleReportedModel}",
  "summary": "我被阻塞了：原因一句话",
  "details": "已尝试什么、卡在哪里",
  "needs": "需要用户或参谋确认什么"
})

如果任务失败，调用：

submit_worker_result({
  "task_id": "${taskId}",
  "outcome": "failed",
  "reported_model": "${submitExampleReportedModel}",
  "summary": "任务失败：原因一句话",
  "details": "错误信息和已尝试操作"
})
`;
}

function resolveSuggestedModel(input: PrepareCursorAgentTaskInput, task: Task): string {
  return input.suggested_model ?? task.suggested_model ?? task.model ?? "user-selected";
}

function buildPackageBody(task: Task, input: PrepareCursorAgentTaskInput): string {
  const suggestedModel = resolveSuggestedModel(input, task);
  const extraInstructions = input.extra_instructions?.trim();
  const extraInstructionsBlock = extraInstructions
    ? `\n附加要求：\n${extraInstructions}\n\n`
    : "";

  const submitExampleReportedModel =
    suggestedModel !== "user-selected" ? suggestedModel : "composer-2-fast";

  return buildAgentTaskMarkdown(
    task.id,
    task.description,
    suggestedModel,
    extraInstructionsBlock,
    submitExampleReportedModel
  );
}

function formatToolReturn(
  markdownBody: string
): string {
  return `${USER_VISIBLE_CURSOR_AGENT_HANDOFF_START}

复制下面完整任务包，粘贴到新的 Cursor Agent / Agents Window 执行。

\`\`\`text
${markdownBody}
\`\`\`

${USER_VISIBLE_CURSOR_AGENT_HANDOFF_END}

${COPY_THIS_CURSOR_AGENT_TASK_PACKAGE_START}

\`\`\`text
${markdownBody}
\`\`\`

${COPY_THIS_CURSOR_AGENT_TASK_PACKAGE_END}`;
}

export async function prepareCursorAgentTask(rawInput: unknown): Promise<string> {
  const input: PrepareCursorAgentTaskInput = prepareCursorAgentTaskInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `任务不存在：${input.task_id}`;
  }

  const { status, worker_route } = task;
  const isCursorWaiting =
    status === "waiting_for_cursor_agent" && worker_route === "cursor_agent";
  const isPending = status === "pending";

  if (!isPending && !isCursorWaiting) {
    if (status === "waiting_for_cursor_agent" && worker_route !== "cursor_agent") {
      return `任务 ${input.task_id} 当前状态为 waiting_for_cursor_agent，但工兵路线不是 cursor_agent，无法准备或重发 Cursor 工兵任务包。`;
    }
    return `任务 ${input.task_id} 当前状态为 ${status}，无法准备或重发 Cursor 工兵任务包。仅支持：pending（首次准备），或 waiting_for_cursor_agent 且工兵路线为 cursor_agent（重发任务包）。`;
  }

  const suggestedModel = resolveSuggestedModel(input, task);
  const markdownBody = buildPackageBody(task, input);

  const agentTasksDir = path.join(PROJECT_ROOT, ".chief", "agent-tasks");
  await mkdir(agentTasksDir, { recursive: true });

  const agentRelativePath = `.chief/agent-tasks/${task.id}.md`;
  const agentAbsolutePath = path.join(PROJECT_ROOT, agentRelativePath);
  await writeFile(agentAbsolutePath, markdownBody, "utf-8");

  if (isPending) {
    await updateTask(input.task_id, {
      status: "waiting_for_cursor_agent",
      worker_route: "cursor_agent",
      suggested_model: suggestedModel,
      agent_task_file: agentRelativePath,
      provider: "cursor_agent",
      model: suggestedModel,
      started_at: new Date().toISOString(),
      error: undefined,
      finished_at: undefined
    });
    return formatToolReturn(markdownBody);
  }

  await updateTask(input.task_id, {
    agent_task_file: agentRelativePath,
    suggested_model: suggestedModel,
    model: suggestedModel,
    provider: "cursor_agent",
    worker_route: "cursor_agent",
    error: undefined
  });

  return formatToolReturn(markdownBody);
}
