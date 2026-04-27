import { z } from "zod";
import { getTask } from "../lib/tasks_store.js";

export const getWorkerSummaryInputSchema = z.object({
  task_id: z.string()
});

type GetWorkerSummaryInput = z.infer<typeof getWorkerSummaryInputSchema>;

export async function getWorkerSummary(rawInput: unknown): Promise<string> {
  const input: GetWorkerSummaryInput = getWorkerSummaryInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `Task ${input.task_id} not found.`;
  }

  const provider = task.provider ?? "unknown";
  const model = task.model ?? "unknown";
  const header = `**${task.id}** · \`${task.status}\` · provider=\`${provider}\` · model=\`${model}\``;

  if (task.status !== "done") {
    return `${header}

Task ${task.id} is not done yet (status: ${task.status}).`;
  }

  return `${header}

${task.summary ?? ""}`;
}
