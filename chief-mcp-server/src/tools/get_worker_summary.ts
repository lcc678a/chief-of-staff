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

  const workerRoute = task.worker_route ?? "external";
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
