import { z } from "zod";
import type { ModelLevel, Task } from "../types.js";
import { readTasks, writeTasks } from "../lib/tasks_store.js";

const planTasksInputSchema = z.object({
  tasks: z.array(
    z.object({
      description: z.string(),
      model_level: z.enum(["cheap", "smart", "genius"])
    })
  )
});

type PlanTasksInput = z.infer<typeof planTasksInputSchema>;

function buildTaskId(index: number): string {
  return `task-${String(index).padStart(3, "0")}`;
}

function getTaskNumber(taskId: string): number | null {
  const match = /^task-(\d+)$/.exec(taskId);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export async function planTasks(rawInput: unknown): Promise<string> {
  const input: PlanTasksInput = planTasksInputSchema.parse(rawInput);
  const existingTasks = await readTasks();
  const maxTaskNumber = existingTasks.reduce((max, task) => {
    const taskNumber = getTaskNumber(task.id);
    if (taskNumber === null) {
      return max;
    }

    return Math.max(max, taskNumber);
  }, 0);

  const now = new Date().toISOString();
  const newTasks: Task[] = input.tasks.map((task, index) => {
    const taskId = buildTaskId(maxTaskNumber + index + 1);
    return {
      id: taskId,
      description: task.description,
      model_level: task.model_level as ModelLevel,
      status: "pending",
      created_at: now,
      updated_at: now
    };
  });

  await writeTasks([...existingTasks, ...newTasks]);

  const rows = newTasks
    .map((task) => `| ${task.id} | ${escapeMarkdownCell(task.description)} | ${task.model_level} |`)
    .join("\n");

  return ["| id | description | model_level |", "| --- | --- | --- |", rows].join("\n");
}

export { planTasksInputSchema };
