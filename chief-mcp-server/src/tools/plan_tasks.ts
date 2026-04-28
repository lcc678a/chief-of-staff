import { z } from "zod";
import type { ModelLevel, Task } from "../types.js";
import { readTasks, writeTasks } from "../lib/tasks_store.js";

const planTasksInputSchema = z.object({
  lane: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
  blocked_by: z.array(z.string()).optional(),
  allowed_files: z.array(z.string()).optional(),
  forbidden_files: z.array(z.string()).optional(),
  tasks: z.array(
    z.object({
      description: z.string(),
      model_level: z.enum(["cheap", "smart", "genius"]),
      depends_on: z.array(z.string()).optional(),
      blocked_by: z.array(z.string()).optional(),
      allowed_files: z.array(z.string()).optional(),
      forbidden_files: z.array(z.string()).optional()
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
    const dependsOn = task.depends_on ?? input.depends_on;
    const blockedBy = task.blocked_by ?? input.blocked_by;
    const allowedFiles = task.allowed_files ?? input.allowed_files;
    const forbiddenFiles = task.forbidden_files ?? input.forbidden_files;
    return {
      id: taskId,
      description: task.description,
      model_level: task.model_level as ModelLevel,
      depends_on: dependsOn,
      blocked_by: blockedBy,
      allowed_files: allowedFiles,
      forbidden_files: forbiddenFiles,
      lane: input.lane,
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
