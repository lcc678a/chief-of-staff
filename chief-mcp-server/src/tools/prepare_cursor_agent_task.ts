import { z } from "zod";
import { getTask, updateTask } from "../lib/tasks_store.js";

export const prepareCursorAgentTaskInputSchema = z.object({
  task_id: z.string(),
  suggested_model: z.string().optional(),
  extra_instructions: z.string().optional()
});

type PrepareCursorAgentTaskInput = z.infer<typeof prepareCursorAgentTaskInputSchema>;

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
  await updateTask(input.task_id, {
    status: "waiting_for_cursor_agent",
    worker_route: "cursor_agent",
    suggested_model: suggestedModel,
    provider: "cursor_agent",
    model: suggestedModel,
    started_at: new Date().toISOString(),
    error: undefined,
    finished_at: undefined
  });

  const extraInstructions = input.extra_instructions?.trim();
  const extraInstructionsBlock = extraInstructions
    ? `\n附加要求：\n${extraInstructions}\n`
    : "";

  return `已准备 Cursor 工兵任务：${task.id}

- 状态：waiting_for_cursor_agent
- 工兵路线：Cursor Agent Worker
- 建议模型：${suggestedModel}

请在 Cursor 中新建一个 Agent / Agents Window，选择你希望使用的模型，然后把下面的任务包完整粘贴给它。

\`\`\`text
你是 Chief-of-Staff 的 Cursor 工兵 Agent。

任务 ID：${task.id}
建议模型：${suggestedModel}
任务描述：${task.description}
${extraInstructionsBlock}
执行要求：
1. 只完成这个任务，不要顺手做无关优化。
2. 如果需要读取项目文件，可以读取必要文件。
3. 不要修改代码，除非任务描述明确要求。
4. 完成后必须调用 MCP 工具 submit_worker_result 回传结果。
5. reported_model 请填写你在 Cursor 工兵窗口实际选择的模型；如果无法确认，填写 unknown。

请调用：
submit_worker_result({
  "task_id": "${task.id}",
  "reported_model": "你实际使用的模型，例如 Sonnet 4.6",
  "summary": "一句话摘要",
  "details": "详细结果"
})
\`\`\``;
}
