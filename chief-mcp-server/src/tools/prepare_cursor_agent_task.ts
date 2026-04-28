import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask, updateTask } from "../lib/tasks_store.js";

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
任务描述：${taskDescription}
${extraInstructionsBlock}
执行要求：
1. 只完成这个任务，不要顺手做无关优化。
2. 如果需要读取项目文件，可以读取必要文件。
3. 不要修改代码，除非任务描述明确要求。
4. 完成后必须调用 MCP 工具 submit_worker_result 回传结果。
5. reported_model：
   - 如果你知道当前 Cursor 工兵窗口实际使用的模型，请填写实际模型。
   - 如果你无法确认实际模型，请填写建议模型：${suggestedModel}。
   - 不要填写 unknown，除非连建议模型也没有。

请调用：
submit_worker_result({
  "task_id": "${taskId}",
  "reported_model": "${submitExampleReportedModel}",
  "summary": "一句话摘要",
  "details": "详细结果"
})
`;
}

export async function prepareCursorAgentTask(rawInput: unknown): Promise<string> {
  const input: PrepareCursorAgentTaskInput = prepareCursorAgentTaskInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `任务不存在：${input.task_id}`;
  }
  if (task.status !== "pending") {
    return `任务 ${input.task_id} 当前状态是 ${task.status}，只有 pending 才能准备为 Cursor 工兵任务。`;
  }

  const suggestedModel = input.suggested_model ?? "user-selected";
  const extraInstructions = input.extra_instructions?.trim();
  const extraInstructionsBlock = extraInstructions
    ? `\n附加要求：\n${extraInstructions}\n`
    : "";

  const submitExampleReportedModel =
    suggestedModel !== "user-selected" ? suggestedModel : "composer-2-fast";

  const markdownBody = buildAgentTaskMarkdown(
    task.id,
    task.description,
    suggestedModel,
    extraInstructionsBlock,
    submitExampleReportedModel
  );

  const agentTasksDir = path.join(PROJECT_ROOT, ".chief", "agent-tasks");
  await mkdir(agentTasksDir, { recursive: true });

  const agentRelativePath = `.chief/agent-tasks/${task.id}.md`;
  const agentAbsolutePath = path.join(PROJECT_ROOT, agentRelativePath);
  await writeFile(agentAbsolutePath, markdownBody, "utf-8");

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

  return `已准备 Cursor 工兵任务：${task.id}

- 状态：waiting_for_cursor_agent
- 工兵路线：Cursor Agent Worker
- 建议模型：${suggestedModel}
- 任务包文件：${agentRelativePath}

下一步：
1. 在 Cursor 中新建 Agent / Agents Window
2. 选择建议模型，或选择你想使用的 Cursor 模型
3. 打开 ${agentRelativePath}
4. 复制全文给 Cursor 工兵执行

如果工具结果被折叠，优先打开任务包文件复制全文。

---

任务包正文（可复制；若上方路径更方便请打开文件）：

\`\`\`text
${markdownBody}
\`\`\``;
}
