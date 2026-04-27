import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ModelLevel, Task } from "../types.js";

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

async function readExistingTasks(tasksFilePath: string): Promise<Task[]> {
  try {
    const raw = await readFile(tasksFilePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as Task[];
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function planTasks(rawInput: unknown): Promise<string> {
  const input: PlanTasksInput = planTasksInputSchema.parse(rawInput);

  const tasksFilePath = path.join(process.cwd(), ".chief", "tasks.json");
  const existingTasks = await readExistingTasks(tasksFilePath);
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

  await mkdir(path.dirname(tasksFilePath), { recursive: true });
  await writeFile(tasksFilePath, JSON.stringify([...existingTasks, ...newTasks], null, 2), "utf-8");

  const rows = newTasks
    .map((task) => `| ${task.id} | ${escapeMarkdownCell(task.description)} | ${task.model_level} |`)
    .join("\n");

  return ["| id | description | model_level |", "| --- | --- | --- |", rows].join("\n");
}

export { planTasksInputSchema };
