export type ModelLevel = "cheap" | "smart" | "genius";
export type TaskStatus = "pending" | "running" | "waiting_for_cursor_agent" | "done" | "failed";

export interface Task {
  id: string;
  description: string;
  model_level: ModelLevel;
  worker_route?: "external" | "cursor_agent" | "host_assisted";
  suggested_model?: string;
  reported_model?: string;
  result_file?: string;
  provider?: string;
  model?: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  summary?: string;
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
