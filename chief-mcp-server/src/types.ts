export type ModelLevel = "cheap" | "smart" | "genius";
export type TaskStatus =
  | "pending"
  | "running"
  | "waiting_for_cursor_agent"
  | "blocked"
  | "done"
  | "failed";

export interface Task {
  id: string;
  description: string;
  model_level: ModelLevel;
  worker_route?: "external" | "cursor_agent" | "host_assisted";
  suggested_model?: string;
  reported_model?: string;
  /** Cursor Agent Worker 任务包文件路径，例如 .chief/agent-tasks/task-001.md */
  agent_task_file?: string;
  result_file?: string;
  provider?: string;
  model?: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  summary?: string;
  /** Cursor 工兵 submit_worker_result 声明的结果类型 */
  outcome?: "done" | "blocked" | "failed";
  /** outcome 为 blocked 时：需要用户或参谋补充的内容 */
  needs?: string;
  error?: string;
  log_file?: string;
  pid?: number;
  started_at?: string;
  finished_at?: string;
}

export interface ChiefConfig {
  default_provider: string;
  providers: Record<
    string,
    {
      api_key_env: string;
      base_url: string;
      models: Record<ModelLevel, string>;
    }
  >;
}
