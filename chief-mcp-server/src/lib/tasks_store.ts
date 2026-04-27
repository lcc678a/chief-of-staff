import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Task } from "../types.js";
import { TASKS_FILE } from "./paths.js";

let writeQueue: Promise<void> = Promise.resolve();

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

async function ensureTasksDir(): Promise<void> {
  await mkdir(path.dirname(TASKS_FILE), { recursive: true });
}

export async function readTasks(): Promise<Task[]> {
  try {
    const raw = await readFile(TASKS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as Task[];
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function writeTasks(tasks: Task[]): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureTasksDir();
    await writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
  });
  await writeQueue;
}

export async function getTask(id: string): Promise<Task | undefined> {
  const tasks = await readTasks();
  return tasks.find((task) => task.id === id);
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task | undefined> {
  let updatedTask: Task | undefined;
  writeQueue = writeQueue.then(async () => {
    const tasks = await readTasks();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      return;
    }

    const nextTask: Task = {
      ...tasks[index],
      ...patch,
      updated_at: new Date().toISOString()
    };
    tasks[index] = nextTask;
    updatedTask = nextTask;
    await ensureTasksDir();
    await writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
  });
  await writeQueue;
  return updatedTask;
}
