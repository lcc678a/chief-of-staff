export type ModelLevel = "cheap" | "smart" | "genius";
export type TaskStatus = "pending" | "running" | "done" | "failed";

export interface Task {
  id: string;
  description: string;
  model_level: ModelLevel;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}
